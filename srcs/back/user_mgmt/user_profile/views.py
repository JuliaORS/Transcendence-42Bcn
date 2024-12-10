from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view
from django.contrib.auth import authenticate, login
from django.template.loader import render_to_string
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.models import User
from rest_framework import status
import json
import requests
from django.conf import settings
import re

@api_view(['GET'])
def user_info_api(request):
    if request.user.is_authenticated:
        context = {
            'user': request.user,  # Pass the user object to the template
        }
        # Render the HTML with the user's data
        user_html = render_to_string('user.html', context)
        return JsonResponse({'user_html': user_html}, content_type="application/json")
    else:
        return JsonResponse({'error': 'user not authenticated'}, status=401)

def player_game_statistics(player_id):
    game_service_url = 'http://game:8001'
    endpoint = f'{game_service_url}/api/player/{player_id}/game_statistics/'

    try:
        response = requests.get(endpoint)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching statistics: {e}")
        return {'games_played': 0, 'games_won': 0}

def player_tournament_statistics(player_id):
    game_service_url = 'http://game:8001'
    endpoint = f'{game_service_url}/api/player/{player_id}/tournament_statistics/'

    try:
        response = requests.get(endpoint)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching statistics: {e}")
        return {'tournaments_played': 0, 'tournament_score': 0}

@api_view(['GET'])
def profile_page(request):
    if request.user.is_authenticated:
        user_id = request.user.id
        stats_games = player_game_statistics(user_id)
        stats_tournaments = player_tournament_statistics(user_id)
        print(stats_games)
        context = {
            'user': request.user,
            'stats_games': stats_games,
            'stats_tournaments': stats_tournaments,
            'MEDIA_URL': settings.MEDIA_URL,
        }
        profile_html = render_to_string('profile.html', context)
        return JsonResponse({'profile_html': profile_html}, content_type="application/json")
    else:
        return JsonResponse({'error': 'user not authenticated'}, status=401)

@api_view(['GET'])
def profile_settings_page(request):
    if request.user.is_authenticated:
        context = {
            'user': request.user,
        }
        profile_settings_html = render_to_string('settings_profile.html', context)
        return JsonResponse({'profile_settings_html': profile_settings_html}, content_type="application/json")
    else:
        return JsonResponse({'error': 'user not authenticated'}, status=401)

@api_view(['POST'])
def update_profile_settings(request):
    if request.user.is_authenticated:
        data = request.data
        user = request.user
        username = data.get('username', user.username)
        first_name = data.get('first_name', '')
        last_name = data.get('last_name', '')

        # if not username or not email or not password or not name:
        #     return JsonResponse({"error": "All fields are required."}, status=status.HTTP_400_BAD_REQUEST)
        
        if not re.match(r'^[a-zA-Z0-9.]+$', username):
            return JsonResponse({'success': False, "error": "Username should consist only of letters, digits and dots(.)."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exclude(id=request.user.id).exists():
            return JsonResponse({'success': False, "error": "Username already exists."}, status=status.HTTP_400_BAD_REQUEST)

        user.username = username
        user.first_name = first_name
        user.last_name = last_name

        if 'photo' in request.FILES:
            profile = user.profile  # to access related profile object
            profile.photo = request.FILES['photo']
            profile.save()

        user.save()

        return JsonResponse({'success': True, 'message': 'Settings updated successfully!'})
    else:
        return JsonResponse({'success': False, 'error': 'User not authenticated.'}, status=401)