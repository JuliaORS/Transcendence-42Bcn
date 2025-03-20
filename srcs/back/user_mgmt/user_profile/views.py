from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate, login
from django.template.loader import render_to_string
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.models import User
from user_mgmt.utils.translations import add_language_context
from rest_framework import status
import json
import requests
from django.conf import settings
import re
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils.translation import activate
from django.contrib.auth.decorators import login_required
from rest_framework_simplejwt.tokens import AccessToken
from .models import Profile
import redis

PROTOCOL_WEB = settings.PROTOCOL_WEB
HOST = settings.HOST
GAME_PORT = settings.GAME_PORT
USER_MGMT_PORT = settings.USER_MGMT_PORT
GAME_SERVICE_URL = PROTOCOL_WEB + "://game:" + GAME_PORT

redis_client = redis.StrictRedis(host='redis', port=6379, db=0)
redis_client.set("test", "Hello Redis!")
print(redis_client.get("test"))

def get_photo_url(user):
    photo_url = None
    if (hasattr(user, 'profile')):
        if user.profile.external_photo_url:
            photo_url = user.profile.external_photo_url
        elif user.profile.photo:
            photo_url = PROTOCOL_WEB + "://" + HOST + ":" + USER_MGMT_PORT + user.profile.photo.url
    return photo_url

@api_view(['GET'])
def user_info_api(request):
    if request.user.is_authenticated:
        context = {
            'user': request.user,  # Pass the user object to the template
        }
        add_language_context(request.COOKIES, context)
        # Render the HTML with the user's data
        user_html = render_to_string('user.html', context)
        return JsonResponse({'user_html': user_html}, content_type="application/json")
    else:
        return JsonResponse({'error': 'user not authenticated'})

def player_game_statistics(request, player_id):
    endpoint = f'{GAME_SERVICE_URL}/api/player/{player_id}/game_statistics/'

    auth_header = request.headers.get('Authorization')
    headers = {"Authorization": auth_header}
    try:
        response = requests.get(endpoint, headers=headers, verify=False)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching statistics: {e}")
        return {'games_played': 0, 'games_won': 0}

def player_tournament_statistics(request, player_id):
    endpoint = f'{GAME_SERVICE_URL}/api/player/{player_id}/tournament_statistics/'

    auth_header = request.headers.get('Authorization')
    headers = {"Authorization": auth_header}
    try:
        response = requests.get(endpoint, headers=headers, verify=False)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching statistics: {e}")
        return {'tournaments_played': 0, 'tournament_score': 0}

@api_view(['GET'])
def player_last_ten_games(request):
    if request.user.is_authenticated:
        player_id = request.user.id
        username = request.user.username
        endpoint = f'{GAME_SERVICE_URL}/api/player/{player_id}/last_ten_games'

        auth_header = request.headers.get('Authorization')
        headers = {"Authorization": auth_header}
        try:
            response = requests.get(endpoint, headers=headers, verify=False)
            response.raise_for_status()
            game_data = response.json()
            return JsonResponse({
                'username': username,
                'games': game_data,
            }, safe=False)
        except requests.RequestException as e:
            return JsonResponse({'error': 'Failed to fetch game data.'}, status=500)
    else:
        return JsonResponse({'error': 'User not authenticated.'})

def player_all_games(request, player_id):
    endpoint = f'{GAME_SERVICE_URL}/api/player/{player_id}/all_games/'

    auth_header = request.headers.get('Authorization')
    headers = {"Authorization": auth_header}
    try:
        response = requests.get(endpoint, headers=headers, verify=False)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching statistics: {e}")
        return {}

@api_view(['GET'])
def match_history_page(request):
    print("In match history api: ", request.user)
    if request.user.is_authenticated:
        user_id = request.user.id
        all_games = player_all_games(request, user_id)
        context = {
            'match_history_games': all_games,
        }
        add_language_context(request.COOKIES, context)
        match_history_html = render_to_string('match_history.html', context)
        return JsonResponse({'match_history_html': match_history_html}, content_type="application/json")
    else:
        return JsonResponse({'error': 'user not authenticated'})


@api_view(['GET'])
def profile_page(request):
    if request.user.is_authenticated:
        user = request.user
        user_id = user.id
        photo_url = None

        print(user.username)
        print("!!!in profile page back")
        stats_games = player_game_statistics(request, user_id)
        print("!!! game stats: ", stats_games)
        stats_tournaments = player_tournament_statistics(request, user_id)

        if hasattr(user, 'profile'):
            photo_url = get_photo_url(user)
        else:
            Profile.objects.create(user=request.user)
        
        context = {
            'user': user,
            'photo_url': photo_url,
            'stats_games': stats_games,
            'stats_tournaments': stats_tournaments,
            'MEDIA_URL': settings.MEDIA_URL,
        }
        add_language_context(request.COOKIES, context)
        profile_html = render_to_string('profile.html', context)
        return JsonResponse({'profile_html': profile_html}, content_type="application/json")
    else:
        return JsonResponse({'error': 'user not authenticated'})

@api_view(['GET'])
def profile_settings_page(request):
    if request.user.is_authenticated:
        two_fa_enabled = request.user.profile.two_fa
        print("TWO FA :::::", two_fa_enabled)
        context = {
            'user': request.user,
            'two_fa_enabled': two_fa_enabled
        }
        add_language_context(request.COOKIES, context)
        profile_settings_html = render_to_string('settings_profile.html', context)
        return JsonResponse({'profile_settings_html': profile_settings_html}, content_type="application/json")
    else:
        return JsonResponse({'error': 'user not authenticated'})

@api_view(['POST'])
def update_profile_settings(request):
    if request.user.is_authenticated:
        user = request.user
        username = request.POST.get('username', user.username)
        first_name = request.POST.get('first_name', '')
        last_name = request.POST.get('last_name', '')

        if not re.match(r'^[a-zA-Z0-9.]+$', username) and not (user.username.startswith('@') and user.username == username):
            return JsonResponse({'success': False, "error": get_translation(request, "invalid_username")})

        if User.objects.filter(username=username).exclude(id=request.user.id).exists():
            return JsonResponse({'success': False, "error": get_translation(request, "username_exists")})

        if len(username) < 2 or len(username) > 10:
            return JsonResponse({'success': False, "error": get_translation(request, "username_length")})

        if len(first_name) < 2 or len(first_name) > 10:
            return JsonResponse({'success': False, "error": get_translation(request, "username_length") + " " + get_translation(request, "please_try_again" )})
        
        if len(last_name) > 15:
            return JsonResponse({'success': False, "error": "lastname_length"})

        user.username = username
        user.first_name = first_name
        user.last_name = last_name
        print("PHOTO:::: ", user.profile.photo)

        if 'photo' in request.FILES:
            profile = user.profile  # to access related profile object
            profile.photo = request.FILES['photo']
            if user.profile.external_photo_url:
                user.profile.external_photo_url = None
            profile.save()

        user.save()
        return JsonResponse({'success': True, 'message': get_translation(request, 'settings_updated'), 'username': username})
    else:
        return JsonResponse({'success': False, 'error': 'User not authenticated.'})

@api_view(['GET'])
def search_users(request):
    query = request.GET.get('q', '') 
    print("query: *" + query + "*")
    if (not hasattr(request.user, 'profile')):
        Profile.objects.create(user=request.user)
    friends = request.user.profile.friends.all()
    for friend in friends:
        name = friend.user.username  # Assuming the name of the friend is stored in the 'name' field
        online_status = friend.online_status  # Assuming the online status is stored in the 'online_status' field
        print(f"Name: {name}, Online Status: {online_status}")
    
    if query:
        users = User.objects.filter(Q(username__icontains=query) | Q(email__icontains=query)).exclude(id=request.user.id)
        results = [
            {
                'photo_url': get_photo_url(user),
                'profile': user.profile,
                'is_friend': request.user.profile.is_friend_already(user.profile) if hasattr(request.user, 'profile') else False
            }
            for user in users if (hasattr(user, 'profile') and user.username != "@AI")
        ]
    else:
        results = []
    # for friend in friends if hasattr(friend.user, 'profile')
    # print(friend.user.username)
    # print(redis_client.exists(f"user:{friend.user.id}:online"))
    friend_list = [
        {
            'photo_url': get_photo_url(friend.user),
            'profile': friend,
            'user': friend.user,
            # 'online_status': friend.is_online
        }
        for friend in friends if hasattr(friend.user, 'profile')
    ]
    context = {
        'user': request.user,
        'results': results,
        'friends_list': friend_list,
        'query': query
    }
    print(results)
    # print(friends[1].username)
    add_language_context(request.COOKIES, context)
    search_users_html = render_to_string('search_users.html', context)
    return JsonResponse({'search_users_html': search_users_html}, content_type="application/json")

@api_view(['POST'])
def add_friend(request, friend_id):
    user_profile = request.user.profile
    friend_profile = get_object_or_404(Profile, pk=friend_id)

    if not user_profile.is_friend_already(friend_profile):
        user_profile.add_friend(friend_profile)
        return JsonResponse({
            'status': 'success',
            'message': 'Friend added successfully!',
            'friend': {
                'id': friend_profile.id,
                'username': friend_profile.user.username,
                'email': friend_profile.user.email if friend_profile.user.email else None,
                'online_status': friend_profile.online_status,  # Assuming this is a boolean field in Profile
                'photo_url': get_photo_url(friend_profile.user),
            }
            })
    return JsonResponse({'status': 'error', 'message': 'Is a friend already.'})

@api_view(['POST'])
def remove_friend(request, friend_id):
    user_profile = request.user.profile
    friend_profile = get_object_or_404(Profile, pk=friend_id)

    if user_profile.is_friend_already(friend_profile):
        user_profile.remove_friend(friend_profile)
        return JsonResponse({'status': 'success', 'message': 'Friend removed successfully!'})
    return JsonResponse({'status': 'error', 'message': 'Is not a friend.'})

@api_view(['POST'])
def save_user_pref_lang(request):
    data = json.loads(request.body)
    lang = data.get('language', 'EN')

    user_profile = request.user.profile
    user_profile.language = lang
    user_profile.save()
    
    activate(lang)
    return JsonResponse({'status': 'success'})

@api_view(['GET'])
@login_required
def get_user_pref_lang(request):
    lang = getattr(request.user.profile, 'language', 'EN')
    return JsonResponse({'status': 'success', 'language': lang})

# def root_view(request):
#     #print('------->entro root_view<-------')
#     jwt_token = request.COOKIES.get('csrftoken')
#     if jwt_token:
#         print('there is a token')
#         try:
#             AccessToken(jwt_token) # throw exception if token is not valid
#             return render(request, 'profile.html')
#         except Exception as e:
#             print(f"Token error: {e}") #invalid token or expired

#     return render(request, 'login.html')

@api_view(['GET'])
@login_required 
def home_page(request):
    print('Home page api called')
    if request.user.is_authenticated:
        context = {
            'user': request.user,  # Pass the user object to the template
        }
        # Render the HTML with the user's data
        add_language_context(request.COOKIES, context)
        home_html = render_to_string('home_page.html', context)
        return JsonResponse({'home_html': home_html}, content_type="application/json")
    else:
        return JsonResponse({'error': 'user not authenticated'})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_main_header(request):
    print('Main Header api called')
    context = {}
    add_language_context(request.COOKIES, context)
    header_html = render_to_string('main_header.html', context)
    
    return JsonResponse({'header_html': header_html}, content_type="application/json")

@api_view(['GET'])
@permission_classes([AllowAny])
def get_languages_header(request):
    print('Languages header api called')
    context = {}
    add_language_context(request.COOKIES, context)
    header_html = render_to_string('language_header.html', context)
    return JsonResponse({'header_html': header_html}, content_type="application/json")

@api_view(['GET'])
@permission_classes([AllowAny])
def get_3D_header(request):
    print('3D header api called')
    context = {}
    add_language_context(request.COOKIES, context)
    header_html = render_to_string('3d_header.html', context)
    return JsonResponse({'header_html': header_html}, content_type="application/json")

@api_view(['GET'])
@permission_classes([AllowAny])
def get_lang_from_cookies(request):
    lang = request.COOKIES.get('language', 'EN')
    return JsonResponse({'status': 'success', 'language': lang}, status=200)

def get_translation(request, key):
    context = {}
    add_language_context(request.COOKIES, context)
    return context.get(key, key)
