from collections import defaultdict
from django.contrib.auth import get_user_model
from django.db import transaction
from channels.layers import get_channel_layer
import logging
import asyncio
from django.template.loader import render_to_string
import random
from game.utils.translations import add_language_context 

logger = logging.getLogger(__name__)

'''
players
	L id	[string]	#player's username
	L alive	[bool]		# 0 = eliminated / 1 = still competing
'''

class TournamentManager:

	def __init__(self, scope, tour_id, max_user_cnt):
		self.scope = scope
		self.id = tour_id
		self.max_user_cnt = max_user_cnt
		self.users = []         # list of all usernames
		self.players = []		# list of players in current round
		self.round = 1
		self.pairs = []

	def get_players_cnt(self):
		return len(self.players)
	
	def get_round_players_cnt(self):
		if (len(self.pairs) >= self.round):
			return len(self.pairs[self.round - 1]) * 2
		return -1

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
		}
		add_language_context(self.scope.get('cookies', {}), context)
		html = render_to_string('waiting_room.html', context)
		page = {
			'html': html,
			'redirect': '/waiting-room',
		}
		return page

	def get_bracket_page(self):
		if self.get_players_cnt() == 1:
			return self.get_final_page()
		context = {
			'pairs': self.pairs,
			'cur_round': self.round,
			'total_cnt': self.max_user_cnt,
		}
		logger.info(f"round:: {self.round}")
		add_language_context(self.scope.get('cookies', {}), context)
		if self.max_user_cnt <= 4:
			html = render_to_string('tournament_bracket4.html', context)
		else:
			html = render_to_string('tournament_bracket8.html')
		page = {
			'html': html,
			'redirect': '/tournament-bracket',
			'status': 'playing',
		}
		return page

	def get_final_page(self):
		context = {
			#"winner": self.players[0]
		}
		add_language_context(self.scope.get('cookies', {}), context)
		html = render_to_string('final_tournament_page.html', context)
		
		page = {
			'html': html,
			'status': 'finished',
		}
		return page

	def handle_tournament_start(self, username): # or new round..?
		self.create_pairs()
		needs_to_play = username in self.players
		opponent = None
		cur_pairs = self.pairs[self.round - 1]

		if (needs_to_play):
			for pair in cur_pairs:
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
		if cnt % 2 == 1:
			self.players.append("@AI")
			cnt += 1

		random.shuffle(self.players)
		cur_pairs = [(self.players[i], self.players[i + 1]) for i in range(0, cnt - 1, 2)]

		# if cnt % 2 == 1:
		# 	cur_pairs.append((self.players[-1], "@AI"))
		
		self.pairs.append(cur_pairs)
		logger.info(self.pairs)

	def save_game_result(self, data):
		winner = data["winner"]
		winner_score = data["winner_score"]
		loser = data["loser"]
		loser_score = data["loser_score"]

		# save data to game table here
		# save data for loser to tournament table

		if loser in self.players:
			logger.info("removing loser from players")
			self.players.remove(loser)

		logger.info(f"players now: {self.players}")
		cnt = self.get_players_cnt()
		round_player_cnt = self.get_round_players_cnt()
		logger.info(f"cnt: {cnt}, round cnt: {round_player_cnt}")

		if (cnt == 1):
			# means that tournament finished
			logger.info("tournament finished")
			# save data to tournament table for winner
			return 'finished'

		elif (cnt * 2 == round_player_cnt):
			# means that round finished
			logger.info("round finished")
			# new round start
			return 'new'
		else:
			logger.info("waiting for round to finish")
			return 'waiting'


