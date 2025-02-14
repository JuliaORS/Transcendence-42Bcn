from channels.generic.websocket import AsyncWebsocketConsumer
from urllib.parse import parse_qs
from .gameManager import GameManager
from .tournamentManager import TournamentManager
from datetime import datetime
from django.conf import settings
import json
import logging
import uuid
import asyncio

logger = logging.getLogger(__name__)

active_games = {}
active_games_lock = asyncio.Lock()
active_tournaments = {}
active_tournaments_lock = asyncio.Lock()

class ThrowError(Exception):
	pass

class PongConsumer(AsyncWebsocketConsumer):

	async def connect(self):
		logger.info("\033[1;32mCONNECT METHOD CALLED\033[0m")
		try:
			self.type = self.scope['url_route']['kwargs']['type']
			self.user = self.scope['user']
			self.role = None
			logger.info(f"SELF.TYPE: {self.type}")
			if self.type == "T":
				#call tournament manager
				try:
					self.tour_id = self.scope['url_route']['kwargs']['tgID']
					logger.info(f"T.ID::{self.tour_id}")
					async with active_tournaments_lock:
						if self.tour_id not in active_tournaments:
							active_tournaments[self.tour_id] = TournamentManager(self.tour_id)
						tournament = active_tournaments[self.tour_id]
						tournament.add_player(self.user.username)
						await self.channel_layer.group_add(self.tour_id, self.channel_name)
						await self.accept()
						logger.info("accepted..")
						logger.info(f"self.channel_name: {self.channel_name}")

						if tournament.get_players_cnt() < tournament.max_user_cnt:
							page = tournament.get_waiting_room_page()
							await self.channel_layer.group_send(
								self.tour_id,
								{
									"type": "new_player_cnt",
									# "player_cnt": tournament.get_players_cnt(),
								}
							)
							await self.send(text_data=json.dumps({
								"type": "html",
								"html": page['html'],
								"redirect": page['redirect'],
							}))
						else:
							page = tournament.get_bracket_page()
							await self.channel_layer.group_send(
								self.tour_id,
								{
									"type": "tournament_starts",
									"message": "Tournament has started",
								}
							)

						# await self.send(text_data=json.dumps({
						# 	"type": "html",
						# 	"html": page['html'],
						# 	"redirect": page['redirect'],
						# }))

				except Exception as e:
					logger.error(f"Error connecting to the tournament: {e}")
					await self.close()

			elif self.type == "G":
				#call game manager
				try:
					self.room_id = self.scope['url_route']['kwargs']['tgID']
					async with active_games_lock:
						if self.room_id not in active_games:
							active_games[self.room_id] = GameManager(self.room_id)
						# TODO: False should be dynamic (player = T / viewer = F)
						self.role = await active_games[self.room_id].join_room(self.user.username, False)
						if not self.role:
							await self.close()
							return
						await self.channel_layer.group_add(self.room_id, self.channel_name)
						await self.accept()

						logger.info(f"Role: {self.role}")

						# Notify the client of their role
						await self.send(json.dumps({
							"type": "role",
							"role": self.role,
							"user": self.user.username
						}))
				except Exception as e:
					logger.error(f"Error connecting to the game: {e}")
					await self.close()

			else:
				raise ThrowError("unexpected input when connecting to websocket")
		except Exception as e:
			logger.error(f"\033[1;31mError during Websocket connect: {e}")
			await self.close()

###################################################

	async def disconnect(self, close_code):
		logger.info("\033[1;32mDISCONNECT METHOD CALLED\033[0m")

		if self.type == "G":
			await self.channel_layer.group_discard(
				self.room_id,
				self.channel_name
			)
			if self.room_id in active_games:
				game = active_games[self.room_id]
				game.cancel_disconnect_task()

				if self.role in game.players:
					del game.players[self.role]
				if len(game.players) < 2:
					game.stop_game()

				if not game.players:
					async with active_games_lock:
						del active_games[self.room_id]
		elif self.type == "T":
			await self.channel_layer.group_discard(
				self.tour_id,
				self.channel_name
			)
			async with active_tournaments_lock:
				if self.tour_id in active_tournaments:
					del active_tournaments[self.tour_id] # to handle properly

		await self.close()

##################################################

	async def receive(self, text_data):
		if self.type == "T":
			try:
				data = json.loads(text_data)
				tournament = active_tournaments[self.tour_id]
				dtype = data["type"]
				if dtype == "bracket_page_request":
					page = tournament.get_bracket_page()
					await self.send(text_data=json.dumps({
						"type": "html",
						"html": page['html'],
					}))
				# elif dtype == "waiting_room_request":
				# 	# send html
				# elif dtype == "game_result":
				# 	# save results

			except Exception as e:
				logger.error(f"\033[1;31mError receiving a message via WebSocket: {e}")

		elif self.type == "G":
			try:
				data = json.loads(text_data)
				if data["type"] == "update":
					game = active_games[self.room_id]
					game.handle_message(self.role, data)
					await game.broadcast_state()
			except Exception as e:
				logger.error(f"\033[1;31mError receiving a message via WebSocket: {e}")
	
###################################################

	async def send_game_update(self, event):
		message = event["message"]
		await self.send(text_data=json.dumps(message))

	async def send_game_status(self, event):
		logger.info("sending status msg (pong)")
		await self.send(text_data=json.dumps(event["message"]))

###################################################

	async def tournament_starts(self, event):
		tournament = active_tournaments[self.tour_id]
		round_data = tournament.handle_tournament_start(self.user.username)
		page = tournament.get_bracket_page()
		await self.send(text_data=json.dumps({
			"type": "html",
			"html": page['html'],
			"redirect": "/tournament-bracket",
			"needs_to_play": round_data['needs_to_play'],
			"opponent": round_data['opponent'],
		}))

	async def new_player_cnt(self, event):
		tournament = active_tournaments[self.tour_id]
		await self.send(text_data=json.dumps({
			"type": "new_player_cnt",
			"player_cnt": tournament.get_players_cnt(),
		}))
