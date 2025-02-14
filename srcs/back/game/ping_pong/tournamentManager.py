from collections import defaultdict
from django.contrib.auth import get_user_model
from django.db import transaction
from channels.layers import get_channel_layer
import logging
import asyncio
from django.template.loader import render_to_string
import random

logger = logging.getLogger(__name__)

'''
players
	L id	[string]	#player's username
	L alive	[bool]		# 0 = eliminated / 1 = still competing
'''

class TournamentManager:

	def __init__(self, tour_id):
		self.id = tour_id
		self.max_user_cnt = 1   # will be 3, 4, 7 or 8
		self.users = []         # list of all usernames
		self.players = []		# list of players in current round
		self.round = 1
		self.pairs = []

	def get_players_cnt(self):
		return len(self.players)

	def add_player(self, username):
		if username not in self.users:
			# self.users[username] = True  # True means the player is waiting
			# self.players[username] = {"alive": True}
			self.users.append(username)
			self.players.append(username)

	def get_waiting_room_page(self):
		total_players = self.get_players_cnt()
		context = {
			'tournament_id': self.id,
			'player_count': total_players,
			'number_players': "Number of Players",
			'home': "Home",
		}
		html = render_to_string('waiting_room.html', context)
		page = {
			'html': html,
			'redirect': '/waiting-room',
		}
		return page

	def get_bracket_page(self):
		context = {
			'home': "Home",
			# pairs
		}
		if self.max_user_cnt <= 4:
			html = render_to_string('tournament_bracket4.html', context)
		else:
			html = render_to_string('tournament_bracket8.html')
		page = {
			'html': html,
			'redirect': '/tournament-bracket',
		}
		return page

	def handle_tournament_start(self, username): # or new round..?
		self.create_pairs()
		needs_to_play = username in self.players
		opponent = None
		if (needs_to_play):
			for pair in self.pairs:
				if username in pair:
					if pair[0] == username:
						opponent = pair[1]
					else:
						opponent = pair[0]
					break

		# if opponent != "@AI" => handle remote game join..

		return {'needs_to_play': needs_to_play, 'opponent': opponent}

	def create_pairs(self):
		cnt = self.get_players_cnt()
		random.shuffle(self.players)
		self.pairs = [(self.players[i], self.players[i + 1]) for i in range(0, cnt - 1, 2)]

		if cnt % 2 == 1:
			self.pairs.append((self.players[-1], "@AI"))
		
		logger.info(self.pairs)

