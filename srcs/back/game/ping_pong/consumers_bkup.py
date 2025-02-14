from channels.generic.websocket import AsyncWebsocketConsumer
from urllib.parse import parse_qs
from .gameManager import GameManager
from datetime import datetime
from django.conf import settings
import json
import logging
import uuid
import asyncio

logger = logging.getLogger(__name__)

class PongConsumer(AsyncWebsocketConsumer):
	async def connect(self):
		logger.info("\033[1;32mCONNECT METHOD CALLED\033[0m")
		try:
			self.role = None
			self.roomID = self.scope['url_route']['kwargs']['room']
			logger.info(f"\033[1;33mself scope url: {self.scope['url_route']}")
			logger.info(f"\033[1;33mself scope kwargs: {self.scope['url_route']['kwargs']}")
				
			logger.info(f"scope user: {self.scope['user']}")
			self.user = self.scope['user'].username


			# Player joins the room
			self.role = GameManager.joinRoom(self.roomID, self.user)
			logger.info(f"self.role: {self.role}")
			if not self.role:
				await self.close()
				return

			await self.channel_layer.group_add(self.roomID, self.channel_name)
			await self.accept()

			total_players = len(GameManager.games[self.roomID]["players"])
			logger.info(f"total_players: {total_players}")
			if total_players == 2 and not GameManager.isGameLoopRunning(self.roomID):
				GameManager.setGameLoopRunning(self.roomID, True)
				self.game_loop_task = asyncio.create_task(self.game_loop())


			logger.info(f"Role: {self.role}, Players: {total_players}")

			# Notify the client of their role
			await self.send(json.dumps({
				"type": "role",
				"role": self.role,
				"user": self.user
			}))

			# Notify all players if two players are ready
			if total_players == 2:
				await self.channel_layer.group_send(
					self.roomID,
					{
						"type": "game_update",
						"message": {"type": "status", "wait": 0}
					}
				)
		except Exception as e:
			logger.error(f"Error during WebSocket connect: {e}")
			await self.close()

	#async def disconnect(self, close_code):
	#	logger.info("DISCONNECT METHOD CALLED")
	#	if self.role is None:
	#		logger.warning("Disconnect called before role assignment.")
	#		return
	#
	#	disc_role = self.role
	#	logger.info(f"user with role {disc_role} is leaving")
	#	if hasattr(self, 'game_loop_task'):
	#		self.game_loop_task.cancel()
	#
	#	await self.channel_layer.group_send(
	#		self.roomID,
	#		{
	#			"type": "game_update",
	#			"message": {"type": "status", "wait": 1}
	#		}
	#	)
	#	GameManager.leaveRoom(self.roomID, self.player_id)
	#
	#	game_state = GameManager.games.get(self.roomID)
	#	if game_state and len(game_state["players"]) == 1:
	#		remaining_player = next(iter(game_state["players"].values()))
	#		winner_msg = await GameManager.start_disconnect_countdown(self.roomID, remaining_player["id"], disc_role)
	#		if winner_msg:
	#			await self.channel_layer.group_send(
	#				self.roomID,
	#				{
	#					"type": "game_endgame",
	#					"message": winner_msg
	#				}
	#			)
	#
	#	await self.channel_layer.group_discard(self.roomID, self.channel_name)
	#	GameManager.setGameLoopRunning(self.roomID, False)
	
	async def disconnect(self, close_code):
		logger.info("DISCONNECT METHOD CALLED")
		if self.role is None:
			logger.warning("Disconnect called before role assignment.")
			return

		disc_role = self.role
		logger.info(f"user with role {disc_role} is leaving")

		if hasattr(self, 'game_loop_task'):
			self.game_loop_task.cancel()

		# Notify other players of the disconnection
		await self.channel_layer.group_send(
		self.roomID,
			{
				"type": "game_update",
				"message": {"type": "status", "wait": 1}
			}
		)

		# Start countdown for disconnection
		game_state = GameManager.games.get(self.roomID)
		logger.info(f"CONSUMERS game_state: {game_state}")
		logger.info(f"CONSUMERS len game_state: {len(game_state['players'])}")
		winner_msg = await GameManager.start_disconnect_countdown(self.roomID, remaining_player["id"], disc_role)
		if winner_msg:
			game_state = GameManager.games.get(selff.roomID)
			if game_state and len(game_state["players"]) == 1:
		 		remaining_player = next(iter(game_state["players"].values()))
			await self.channel_layer.group_send(
			self.roomID,
				{
					"type": "game_endgame",
					"message": winner_msg
				}
			)
		else:
			logger.info("Countdown was canceled, no winner declared.")

		await self.channel_layer.group_discard(self.roomID, self.channel_name)
		GameManager.setGameLoopRunning(self.roomID, False)


	async def receive(self, text_data):

		try:
			data = json.loads(text_data)
			game = GameManager.games.get(self.roomID)
			if not game:
				return
			if data["type"] == "update" or data["type"] == "ballUpdate":
				msg = GameManager.handleMessage(self.roomID, self.role, data)
				
			await self.channel_layer.group_send(
				self.roomID,
				{
					"type": "game_update",
					"message": msg
				}
			)

		except Exception as e:
			logger.error(f"Error processing message: {e}")
			logger.info(f"\033[1;31m{text_data}\033[0m");

	async def broadcast(self, event):
		await self.send(json.dumps(event["message"]))

	async def game_update(self, event):
		await self.send(json.dumps({
			"type": "update",
			**event["message"],
		}))

	async def game_endgame(self, event):
		logger.info("\033[1;32mENDGAME METHOD CALLED\033[0m")
		await self.send(json.dumps({
			"type": "endgame",
			**event["message"],
		}))

	async def game_loop(self):
		try:
			logger.info("game_loop is up and running")
			while True:
				game_state = GameManager.games[self.roomID]
				if len(game_state["players"]) < 2:
					break
				GameManager.updateBallPos(game_state)

				await self.channel_layer.group_send(
					self.roomID,
					{
						"type": "game_update",
						"message": {
							"ball": game_state["ball"],
							"scores": game_state["scores"],
							"players": {
								role: {"y": player["y"]}
								for role, player in game_state["players"].items()
							},
						}
					}
				)

				await asyncio.sleep(1 / 15)  # 15 FPS
		except asyncio.CancelledError:
			logger.info(f"Game loop cancelled for room: {self.roomID}")
		except Exception as e:
			logger.error(f"Error in game loop: {e}")

