from django.urls import path
from . import views

urlpatterns = [
    path('api/player/<int:player_id>/tournament_statistics/', views.get_player_tournament_statistics, name='player_tournament_statistics'),
    path('api/tournament-home-page/', views.tournament_home_page, name="tournament_home_page"),
    path('api/tournament-creator/', views.tournament_creator, name="tournament_creator"),
    path('api/get-players-count/<str:tournament_id>/', views.get_players_count, name="get_players_count"),
    path('api/join-tournament-page/', views.join_tournament_page, name="join_tournament_page"),
    path('api/join-tournament/<str:tournament_id>/', views.join_tournament, name="join_tournament"),
    path('api/waiting-room-page/<str:tournament_id>/', views.waiting_room_page, name="waiting_room_page"),
    path('api/get-tournament-id/', views.get_tournament_id, name="get_tournament_id"),
    path('api/tournament-bracket-page/<str:tournament_id>/', views.tournament_bracket_page, name="tournament_bracket_page"),
]