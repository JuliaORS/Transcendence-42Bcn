from django.http import JsonResponse, HttpResponse
from pathlib import Path
from django.contrib.auth.models import User
import logging
import json
import os
import random
import string
import requests

from django.contrib.auth import authenticate, login as django_login
from django.contrib.auth import logout as django_logout
from django.contrib.auth.models import AnonymousUser, User
from django.conf import settings
from django.shortcuts import redirect
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.decorators import api_view, permission_classes
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import status
from django.templatetags.static import static
import re
from .views import generate_temp_token
from datetime import datetime

FRONT_PORT = settings.FRONT_PORT
HOST = settings.HOST
REDIRECT_URI = settings.REDIRECT_URI

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([AllowAny])
def login_intra(request):
    state = gen_state()
    # logger.info("Redirect URI: %s", REDIRECT_URI)

    go_to_api = (
        "https://api.intra.42.fr/oauth/authorize"
        f"?client_id={settings.UID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=public"
        f"&state={state}"
    )
    return redirect(go_to_api)


def gen_state():
	return ''.join(random.choices(string.ascii_letters + string.digits, k=16))

class Callback42API(APIView):
    """ """

    permission_classes = [AllowAny]

    def post(self, request):
        code = request.GET.get('code')
        state = request.GET.get('state')
        logger.info(f"Code: {code}, State: {state}")
        if not state or not code:
            raise AuthenticationFailed("Invalid authentication parameters")
        try:
            response = post42("/oauth/token", defaultParams(code, state))
            if response.status_code != 200:
                raise AuthenticationFailed("Bad response code while authentication")
            data = response.json()
            intra_token = data.get("access_token")
            user = saveUser(str(intra_token))
            if user == AnonymousUser:
                raise AuthenticationFailed("Authentication failed")
            profile = user.profile
            if profile.two_fa:
                temp_token = generate_temp_token(user)
                return Response({
                    'success': True,
                    'two_fa_required': True,
                    'temp_token': temp_token,
                    'intra_token': str(intra_token),
                    'username': user.first_name,
                    'message': '2FA required. Provide the verification code.'
                })
            if request.user.is_authenticated:
               logger.info(f"User authenticated successfully: {request.user.username}")
            else:
                logger.info("User authentication failed")
            refresh_token = RefreshToken.for_user(user)
            loginResponse = {
                'success': True,
                'two_fa_required': False,
                'refresh_token': str(refresh_token),
                'access_token': str(refresh_token.access_token), 
                'username': user.username,
                'name': user.first_name
            }
            return JsonResponse(loginResponse)
        except Exception as e:
            return JsonResponse({'Error': str(e)}, status=400)

def saveUser(token):
    try:
        user_res = get42('/v2/me', None, token)
        if user_res.status_code != 200:
            raise AuthenticationFailed("Bad response code while authentication")
        user_data = user_res.json()
        if not user_data.get('login'):
            raise AuthenticationFailed("Couldn't recognize the user")
        name42 = '@' + user_data.get('login')
        try:
            exist = User.objects.filter(username=name42).exists()
            if exist:
                return User.objects.get(username=name42)
        except Exception as e:
            logger.info("Database empty, creating a user...")
        user = User(username=name42, email=user_data.get('email'), first_name=user_data.get('first_name'), last_name=user_data.get('last_name')) # add first_name, last_name, photo
        user.save()
        user_img = None # here the default
        if user_data['image']['link']:
            user_img = user_data['image']['link']
        user.profile.external_photo_url = user_img
        user.profile.save()
        return user
    except Exception as e:
        return AnonymousUser()

def defaultParams(code, state):
    params = {
        'grant_type': 'authorization_code',
        'client_id': os.environ['UID'],
        'client_secret': os.environ['SECRET'],
        'code': code,
        'redirect_uri': REDIRECT_URI,
        'state': state
    }
    return params

def post42(url, vars):
    url = "https://api.intra.42.fr" + url
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    response = requests.request("POST", url, headers=headers, data=vars)
    return response

def get42(url, vars, auth):
    url = "https://api.intra.42.fr" + url
    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + auth
    }
    response = requests.request("GET", url, headers=headers)
    return response
