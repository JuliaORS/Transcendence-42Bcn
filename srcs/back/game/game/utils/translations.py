from django.utils.translation import activate

def add_language_context(request, context=None):
    if context is None:
        context = {}
    
    lang = request.COOKIES.get('language') or 'en'
    lang_words = get_lang_words(lang)
    context.update(lang_words)
    return context
	
def get_lang_words(lang):
    if lang == 'es':
        return {
            'my_profile': "Mi perfil",
            'enter_name': "Indica el nombre del segundo jugador:",
            'start_game': "Empezar el juego",
            'tournament': "Torneo",
            'home': "Inicio",
            'create': "Crear",
            'join': "Unirse",
            'create_tournament': "Crear Torneo",
            'number_players': "Número de jugadores",
            'players_number': "Introduce el número de jugadores:",
            'submit': "Enviar",
            'start_tournament': "Iniciar torneo",
            'quit': "Salir",
            'play': "Jugar",
            'ranking': "Clasificación",
        }
    elif lang == 'ca':
        return {
            'my_profile': "El meu perfil",
            'enter_name': "Indica el nom del segon jugador:",
            'start_game': "Comença el joc",
            'tournament': "Torneig",
            'home': "Inici",
            'create': "Crea",
            'join': "Uneix-te",
            'create_tournament': "Crea Torneig",
            'number_players': "Nombre de jugadors",
            'players_number': "Introdueix el nombre de jugadors:",
            'submit': "Envia",
            'start_tournament': "Inicia el torneig",
            'quit': "Sortir",
            'play': "Jugar",
            'ranking': "Classificació",
        }
    elif lang == 'ru':
        return {
            'my_profile': "Мой профиль",
            'enter_name': "Введите имя второго игрока:",
            'start_game': "Начать игру",
            'tournament': "Турнир",
            'home': "Главная",
            'create': "Создать",
            'join': "Присоединиться",
            'create_tournament': "Создать Турнир",
            'number_players': "Количество игроков",
            'players_number': "Введите количество игроков:",
            'submit': "Отправить",
            'start_tournament': "Начать турнир",
            'quit': "Выйти",
            'play': "Играть",
            'ranking': "Рейтинг",
        }
    elif lang == 'lv':
        return {
            'my_profile': "Mans profils",
            'enter_name': "Ievadiet otrā spēlētāja vārdu:",
            'start_game': "Sākt spēli",
            'tournament': "Turnīrs",
            'home': "Sākums",
            'create': "Izveidot",
            'join': "Pievienoties",
            'create_tournament': "Izveidot Turnīru",
            'number_players': "Spēlētāju skaits",
            'players_number': "Ievadiet spēlētāju skaitu:",
            'submit': "Iesniegt",
            'start_tournament': "Sākt turnīru",
            'quit': "Iziet",
            'play': "Spēlēt",
            'ranking': "Reitings",
        }
    else:  # Default to English if no match
        return {
            'my_profile': "My Profile",
            'enter_name': "Enter second player's name:",
            'start_game': "Start the game",
            'tournament': "Tournament",
            'home': "Home",
            'create': "Create",
            'join': "Join",
            'create_tournament': "Create Tournament",
            'number_players': "Number of players",
            'players_number': "Enter the number of players:",
            'submit': "Submit",
            'start_tournament': "Start tournament",
            'quit': "Quit",
            'play': "Play",
            'ranking': "Ranking",
			'play again': "Play again",
			'back': "Back",
			'logout': "Logout",
			'waiting_message': "Waiting for player...",
			'game_title': "CRRRRAAAZZZY PONG!",
			'restart': "Restart",
		}
