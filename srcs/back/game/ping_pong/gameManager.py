from collections import defaultdict
import logging
import asyncio

from django.contrib.auth import get_user_model
from django.db import transaction

from channels.layers import get_channel_layer

def get_game_model():
    from .models import Game  # Import inside function
    return Game


logger = logging.getLogger(__name__)

'''
players
	L player1
		L id [int]	#username
		L y  [int]	#paddle's y coord
	L player2
		L id [int]
		L y  [int]
'''

'''
users {"user1", "user2"}	#bkup of the players' usernames (used in disconnection)
'''

'''
viewers {"user3", "user4", ...}	#probably not gonna use it
'''

'''
ball
	L x			[int]	#ball's x position
	L y			[int]	#ball's y position
	L xspeed	[int]	#ball's speed: x component
	L yspeed	[int]	#ball's speed: y component
'''

'''
scores
	L player1	[int]	#player1's score
	L player2	[int]	#player2's score
'''


class GameManager:

	ball_config = {"rad": 10, "xspeed": 4, "yspeed": 4}
	board_config = {"width": 800, "height": 400, "max_score": 5}
	paddle_config = {"width": 10, "height": 80, "speed": 5}
	countdown = 10

	def __init__(self, game_id):
		self.id = game_id
		self.players = {}
		self.users = []
		self.viewers = {}
		self.ball_lock = asyncio.Lock() #similar to mutex
		self.scores = {"player1": 0, "player2": 0}
		self.disconnect_task = None
		self.game_loop_task = None
		self.status = 1
		self.ball = {
			"x": GameManager.board_config["width"] // 2,
			"y": GameManager.board_config["height"] // 2,
			"xspeed": 4,
			"yspeed": 4
		}

###############################################

	async def join_room(self, user, play): #user = [string] username || play = [bool] player/viewer
		logger.info(f"room id {self.id} total players: {len(self.players)}")
		logger.info(self.players)
		if any(player["id"] == user for player in self.players.values()):
			role = next((key for key, value in self.players.items() if value["id"] == user), None)
			if role:
				if len(self.players) == 2:
					self.status = 0
				return role
			return None

		#if play == False:
			#handle viewers

		elif len(self.players) >= 2:
			logger.info(f"Access denied to {user}. Room {self.id} is already full")
			return None
		else:
			if len(self.players) == 0:
				logger.info(f"adding {user} as player1")
				self.players["player1"] = {"id": user, "y": 250}
				return "player1"
			else:
				logger.info(f"adding {user} as player2")
				self.players["player2"] = {"id": user, "y": 250}
				self.status = 0
				return "player2"
			self.users.append(user)
		return "viewer"

#################################################

	def handle_message(self, role, data):
		if data["type"] == "update" and data["role"] in self.players and data["y"]:
			self.players[data["role"]]["y"] = data["y"]

##################################################

	def update_ball(self):
		self.ball["x"] += self.ball["xspeed"]
		self.ball["y"] += self.ball["yspeed"]
		paddle_collision = self.is_paddle_collision()

		if paddle_collision:
			self.ball["xspeed"] *= -1
		if self.ball["y"] <= 0 or self.ball["y"] >= GameManager.board_config["height"]:
			self.ball["yspeed"] *= -1
		if not paddle_collision and self.ball["x"] < GameManager.paddle_config["width"]:
			self.scores["player1"] += 1
			self.reset_ball(1)
			if self.scores["player1"] == GameManager.board_config["max_score"]:
				declare_winner("player1")
		elif (not paddle_collision and
			self.ball["x"] > GameManager.board_config["width"] - GameManager.paddle_config["width"]):
			self.scores["player2"] += 1
			self.reset_ball(0)
			if self.scores["player2"] == GameManager.board_config["max_score"]:
				declare_winner("player2")

##################################################

	async def ready_steady_go():
		await asyncio.sleep(4)
		self.status = 0
		await self.send_status(0)

	async def scored(self):	#role [string] => role of the player who scored
		self.status = 1
		self.scores[role] += 1
		self.ball["xspeed"]	*= -1
		await self.send_status(4)
		ready_steady_go()

#################################################

	def reset_ball(self, new_dir): #new_dir [bool] true when player1 scored
		self.ball["x"] = GameManager.board_config["width"] // 2
		self.ball["y"] = GameManager.board_config["height"] // 2
		if new_dir:
			self.ball["xspeed"] = -4
			self.ball["yspeed"] = 4
		else:
			self.ball["xspeed"] = 4
			self.ball["yspeed"] = -4

####################################################

	def is_paddle_collision(self):

		if ((self.ball["x"] <= GameManager.paddle_config["width"]) and
			((self.ball["y"] < self.players["player1"]["y"] - GameManager.paddle_config["height"] // 2) or
			(self.ball["y"]) > self.players["player1"]["y"] + GameManager.paddle_config["height"] // 2)):
			return True
		if ((self.ball["x"] >= GameManager.board_config["width"] - GameManager.paddle_config["width"]) and
			((self.ball["y"] < self.players["player2"]["y"] - GameManager.paddle_config["height"] // 2) or
			(self.ball["y"]) > self.players["player2"]["y"] + GameManager.paddle_config["height"] // 2)):
			return True
		return False

######################################################

	async def disconnect_countdown(): #0 => task cancelled || 1 => task finished
		try:
			await asyncio.sleep(GameManager.countdown)
		except asyncio.CancelledError:
			logger.warn(f"\033[1;33mCountdown cancelled\033[0m")
			return 0
		return 1

	async def start_disconnect_countdown(self, disc_role):
		self.status = 1
		await self.send_status(GameManager.countdown)
		if disconnect_task:
			logger.warning(f"\033[1;33mCountdown task already exists for room {roomID}."
							"Overwriting previous task\033[0m")
		self.disconnect_task = asyncio.create_task(disconnect_countdown(GameManager.countdown))
		finished_countdown = await task
		self.disconnect_task = None

		if finished_countdown:
			if disc_role == "player1":
				self.declare_winner("player2")
			else:
				self.declare_winner("player1")
		await ready_steady_go()

#########################################################

	def cancel_disconnect_task(self):
		if self.disconnect_task:
			self.diconnect_task.cancel()
			del self.disconnect_task
			self.disconnect_task = None
			self.status = 0

#########################################################

	async def declare_winner(self, winner_role):

		winner_id = self.players["winner_role"]["id"]

		game = get_game_model()

		#save the game result
		#saved_game = self.save_game_result(winner_id, db_players)
		saved_game = self.save_game_result(winner_id)

		if saved_game:
			logger.info(f"Game successfully saved: {saved_game}")
		logger.info(f"Player {winner_id} wins in room {'self.id'}")
		message = {
			"type": "endgame",
			"wait": 1,
			"winnerID": winner_id,
			"loserID": next((loser for loser in self.users if loser != winner_id), None)
		}
		channel_layer = get_channel_layer()
		await channel_layer.group_send(
			self.id,
			{
				"type": "send_game_msg", #function in PongConsumer
				"message": message
			})

#########################################################

	def save_game_score(self, winner_id):
		try:
			Game = get_game_model()
			with transaction.atomic(): #Ensure atomicity
				winner = User.objects.filter(id=winner_id).first()
				player1 = winner
				if self.players["player1"]["id"] == winner_id:
					player2 = User.objects.filter(id=self.players["player1"]["id"])
				else:
					player2 = User.objects.filter(id=self.players["player2"]["id"])

				if self.scores["player1"] > self.scores["player2"]:
					score1 = self.scores["player1"]
					score2 = self.scores["player2"]
				else:
					score1 = self.scores["player2"]
					score2 = self.scores["player1"]

				# Save the game result
				game = Game.objects.create(
					player1=player1,
					score_player1=score1,
					player2=player2,
					score_player2=score2,
					winner=winner,
					tournament_id=-1 # we need to make it dynamic
				)
				game.save()

				return game #return the saved game instance

		except Exception as e:
			logger.info(f"Error saving game result: {e}")
			return None

#########################################################

	async def game_loop(self):
		logger.info(f"Starting game loop with status: {self.status}")
		try:
			while self.status == 0:
				async with self.ball_lock:
					self.update_ball()
				await self.update_game()
				await asyncio.sleep(0.016)
		except Exception as e:
			logger.error(f"Error in game loop: {e}")


#########################################################

	async def update_game(self):
		message = {
			"type": "update",
			"ball": self.ball,
			"players": self.players,
			"scores": self.scores
		}
		channel_layer = get_channel_layer()
		await channel_layer.group_send(
			self.id,
			{
				"type": "send_game_msg", #function in PongConsumer
				"message": message
			})

############################################################

	async def send_status(self, countdown):
		logger.info("sending status msg (gameMan)")
		message = {
			"type": "status",
			"ball": self.ball,
			"players": self.players,
			"scores": self.scores,
			"wait": self.status,
			"countdown": countdown
		}
		channel_layer = get_channel_layer()
		await channel_layer.group_send(
			self.id,
			{
				"type": "send_game_msg", #function in PongConsumer
				"message": message
			})

##############################################################

	async def start_game(self):
		if self.game_loop_task is None:
			logger.info(f"\033[1;33mThe game has started in room {self.id}\033[0m")
			await ready_steady_go()
			self.game_loop_task = asyncio.create_task(self.game_loop())

	def stop_game (self):
		logger.info(f"The game has stopped in room {self.id}")
		self.status = 1
		if self.game_loop_task:
			self.game_loop_task_cancel()
			self.game_loop_task = None

#################################################################

	def game_loop_task_cancel(self):
		if self.game_loop_task:
			self.game_loop_task.cancel()
			del self.game_loop_task
			self.game_loop_task = None
			self.status = 1
