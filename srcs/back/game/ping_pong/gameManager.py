from collections import defaultdict
import logging
import asyncio
from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from django.db import transaction
from channels.layers import get_channel_layer
from channels.db import database_sync_to_async

def get_game_model():
	 from .models import Game  # Import inside function
	 return Game

logger = logging.getLogger(__name__)

'''
players
	L player1
		L id [string]	#username
		L y  [int]		#paddle's y coord
	L player2
		L id [string]
		L y  [int]
'''

'''
users {"user1", "user2"}	#bkup of the players' usernames (for connection control purposes)
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

'''
sizes => absolute
positions => relative
speeds => relative
'''
class GameManager:


	ball_config = {"rad": 8, "xspeed": 4, "yspeed": 6}
	board_config = {"width": 600, "height": 400, "max_score": 3}

	paddle_config = {"width": 7, "height": 70, "speed": 6}
	countdown = 200000

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
		self.ready = 0
		self.start = True
		self.channel_layer = get_channel_layer()
		self.ball = {
			"x": 0.5,
			"y": 0.5,
			"xspeed": GameManager.ball_config["xspeed"],
			"yspeed": GameManager.ball_config["yspeed"]
		}
		self.tour_id = None
		self.tour_op = None
		self.rsg_task = None
		self.player2_waiting_task = None

###############################################

	async def join_room(self, user, play): #user = [string] username || play = [bool] player/viewer
		# logger.info(f"room id {self.id} total players: {len(self.players)}")
		# logger.info(f"current players in the room: {self.players}")
		if any(player["id"] == user for player in self.players.values()):
			self.cancel_disconnect_task()
			role = next((key for key, value in self.players.items() if value["id"] == user), None)
			if role:
				if user in self.users:
					logger.info(f"{user} is already in the room. Rejecting new connection")
				if self.tour_id:
					return role
				return "ALREADY_THERE"

				if len(self.players) == 2:
					self.status = 0
					self.users.append(user)
					if self.player2_waiting_task:
						self.player2_waiting_task.cancel()
				return role
			# logger.info(f"Reconnection error for user {user}. Please, try again later")
			return "4001"

		elif len(self.players) >= 2:
			# logger.info(f"Access denied to {user}. Room {self.id} is already full")
			return "4002"
		else:
			self.users.append(user)
			if len(self.players) == 0:
				# logger.info(f"adding {user} as player1")
				self.players["player1"] = {"id": user, "y": 0.5}
				if self.player2_waiting_task:
					self.player2_waiting_task.cancel()
				if self.tour_id:
					self.player2_waiting_task = asyncio.create_task(self.check_unstarted_game())

				return "player1"
			else:
				if self.player2_waiting_task:
					self.player2_waiting_task.cancel()
				self.players["player2"] = {"id": user, "y": 0.5}
				self.status = 0
				return "player2"
		return "viewer"

#################################################

	def handle_message(self, role, data):
		if data["type"] == "update" and data["role"] in self.players and data["y"]:
			self.players[data["role"]]["y"] = data["y"]
	
	# def handle_message(self, role, data):
	# 	if data["type"] == "update" and data["role"] in self.players and data["y"]:
	# 		if data["y"] < 0:
	# 			self.players[data["role"]]["y"] = 0 + GameManager.paddle_config["height"] / GameManager.board_config["height"]
	# 		elif data["y"] > 1:
	# 			self.players[data["role"]]["y"] = 1 - GameManager.paddle_config["height"] / GameManager.board_config["height"]
	# 		else:
	# 			self.players[data["role"]]["y"] = data["y"]


##################################################

	async def has_scored(self, role):
		self.status = 1
		self.reset_positions(role)
		self.scores[role] += 1

		# logger.info(f"current scores: {self.scores}\nMAX scores: {GameManager.board_config['max_score']}")
		if self.scores[role] == GameManager.board_config["max_score"]:
			await self.declare_winner(role)
		else:
			self.rsg_task = asyncio.create_task(self.ready_steady_go())
			await self.send_status(3)

	
	def is_pad_col_side(self):
		boardW = GameManager.board_config["width"]
		boardH = GameManager.board_config["height"]
		radius = GameManager.ball_config["rad"]
		
		padH = GameManager.paddle_config["height"] / 2
		pl1 = self.players["player1"]["y"] * boardH
		pl2 = self.players["player2"]["y"] * boardH
		#Left paddle
		if self.ball["x"] * boardW - radius <= GameManager.paddle_config["width"]:
			if ((self.ball["y"] * boardH <= pl1 + padH + 1) and
				(self.ball["y"] * boardH >= pl1 - padH - 1)):
				logger.info(f"Side col, ball at {self.ball['x'] * boardW}, paddle at {GameManager.paddle_config['width']}")
				self.ball["x"] = (GameManager.paddle_config["width"] + radius + 2) / boardW
				return True
		#Right paddle
		elif self.ball["x"] * boardW + radius >= boardW - GameManager.paddle_config["width"] - 1:
			if ((self.ball["y"] * boardH <= pl2 + padH + 1) and
				(self.ball["y"] * boardH >= pl2 - padH - 1)):
				logger.info(f"Side col, ball at {self.ball['x'] * boardW}, paddle at {boardW - GameManager.paddle_config['width'] - 1}")
				self.ball["x"] = (boardW - GameManager.paddle_config["width"] - radius - 2) / boardW
				return True
		return False

	def is_pad_col_top(self):
		radius = GameManager.ball_config["rad"]
		padH = GameManager.paddle_config["height"] / 2
		ballY = self.ball["y"] * GameManager.board_config["height"]
		pl1_y = self.players["player1"]["y"] * GameManager.board_config["height"]
		pl2_x =  GameManager.board_config["width"] - GameManager.paddle_config["width"]
		pl2_y = self.players["player2"]["y"] * GameManager.board_config["height"]

		# Left paddle
		if self.ball["x"] * GameManager.board_config["width"] - radius <= GameManager.paddle_config["width"]:
			logger.info(f"col Top pl1 x area")
			if ((ballY + radius >= pl1_y - padH) and
				(ballY - radius <= pl1_y + padH)):
				logger.info(f"Top col, ball at X {self.ball['x'] * GameManager.board_config['width']}, paddle at {GameManager.paddle_config['width']}")
				logger.info(f"ball Y is {ballY}, paddle Y at {pl1_y}")
				# logger.info(f"col Top pl1")

				return True
		# Right paddle # APPLY CHANGES HERE
		elif self.ball["x"] * GameManager.board_config["width"] + radius >= pl2_x:
			#logger.info(f"col Top pl2 x area")
			if ((ballY + radius >= pl2_y - padH) and
				(ballY - radius <= pl2_y + padH)):
				logger.info(f"Top col, ball at X {self.ball['x'] * GameManager.board_config['width']}, paddle at {GameManager.board_config['width'] - GameManager.paddle_config['width'] - 1}")
				logger.info(f"ball Y is {ballY}, paddle Y at {pl2_y}")
				#logger.info(f"col Top pl2")
				return True
		return False
	

	async def update_ball(self):
		radius = GameManager.ball_config["rad"] / GameManager.board_config["height"]
		self.ball["x"] += self.ball["xspeed"] / GameManager.board_config["width"]
		self.ball["y"] += self.ball["yspeed"] / GameManager.board_config["height"]
		ballX = self.ball["x"] * GameManager.board_config["width"]
		ballY = self.ball["y"] * GameManager.board_config["height"]
		is_col_s = self.is_pad_col_side()
		is_col_t = self.is_pad_col_top()

		# logger.info(f"Collitions TOP")
		if is_col_s:
			self.ball["xspeed"] *= -1
			#self.ball["x"] += self.ball["xspeed"] * 3 / GameManager.board_config["width"]
			logger.info(f"Collitions SIDE, xspeed of the ball {self.ball['xspeed']}")
		elif is_col_t:
			self.ball["yspeed"] *= -1
			self.ball["y"] += self.ball["yspeed"] / GameManager.board_config["height"]
			logger.info(f"Collitions TOP")
		#elif self.ball["y"] - radius <= 0:
		elif ballY - GameManager.ball_config["rad"] <= 0:
			logger.info(f"Coll top border {self.ball['y']}")
			self.ball["yspeed"] *= -1
			self.ball["y"] = (GameManager.ball_config["rad"] + 2) / GameManager.board_config["height"]

		#elif self.ball["y"] + radius >= 1:
		elif ballY + GameManager.ball_config["rad"] >= GameManager.board_config["height"]:
			logger.info(f"Coll bottom border {self.ball['y']}")
			self.ball["yspeed"] *= -1
			self.ball["y"] = (GameManager.board_config["height"] - GameManager.ball_config["rad"] - 2) / GameManager.board_config["height"]
		if not (is_col_s and is_col_t) and (ballX - GameManager.ball_config["rad"] <= 0):
			await self.has_scored("player2")
		elif not (is_col_s and is_col_t) and (ballX + GameManager.ball_config["rad"] >= GameManager.board_config["width"]):
			await self.has_scored("player1")


##################################################

	async def ready_steady_go(self): #RSG
		# logger.info("RSA 3 2 1...")
		try:
			await asyncio.sleep(2)
			self.status = 0
			await self.send_status(0)
		except Exception as e:
			logger.error(f"Error in Ready Steady Go: {e}")

#################################################

	def reset_positions(self, role):

		logger.info(f"RESET POS")
		self.ball["x"] = 0.5
		self.ball["y"] = 0.5

		if role == "player1":
			self.ball["xspeed"] = -GameManager.ball_config["xspeed"]
			self.ball["yspeed"] = GameManager.ball_config["yspeed"]
		else:
			self.ball["xspeed"] = GameManager.ball_config["xspeed"]
			self.ball["yspeed"] = -GameManager.ball_config["yspeed"]

		self.players["player1"]["y"] = 0.5
		self.players["player2"]["y"] = 0.5


####################################################

	async def disconnect_countdown(self): #0 => task cancelled || 1 => task finished
		try:
			await asyncio.sleep(GameManager.countdown)
		except asyncio.CancelledError:
			logger.warn(f"\033[1;33mCountdown cancelled\033[0m")
			return 0
		return 1

	async def start_disconnect_countdown(self, disc_role):
		if self.disconnect_task:
			logger.warning(f"\033[1;33mCountdown task already exists for room {roomID}."
							"Overwriting previous task\033[0m")
		self.disconnect_task = asyncio.create_task(self.disconnect_countdown())
		finished_countdown = await self.disconnect_task
		self.disconnect_task = None

		if finished_countdown: #task finished => the opponent didn't reconnect
			if disc_role == "player1":
				await self.declare_winner("player2")
			else:
				await self.declare_winner("player1")
		else:
			await self.ready_steady_go()

#########################################################

	async def cancel_disconnect_task(self):
		if self.disconnect_task:
			self.disconnect_task.cancel()
			try:
				await self.disconnect_task
			except asyncio.CancelledError:
				pass
			self.disconnect_task = None
			self.status = 0

#########################################################

	async def declare_winner(self, winner_role):
		if self.rsg_task:
			self.rsg_task.cancel()
			del self.rsg_task
			self.rsg_task = None
		# self.game_loop_task_cancel()

		# logger.info(f"and the winner is... {winner_role}")
		winner_id = self.players[winner_role]["id"]



		if not "T_" in self.id:
			game = get_game_model()

			#save the game result
			saved_game = await self.save_game_score(winner_id)

			if saved_game:
				logger.info(f"Game successfully saved: {saved_game}")
			else:
				logger.info("F*ck, couldn't save the game")
		# logger.info(f"Player {winner_id} wins in room {self.id}")
		loser = self.users[1] if winner_id == self.users[0] else self.users[0]
		# loser = next((value['id'] for value in self.players.values() if value['id'] != winner_id), None)
		logger.info(f"Player {winner_id} wins in room {self.id}")
		logger.info(f"Player {loser} loses in room {self.id}")
		
		message = {
			"type": "endgame",
			"winner": winner_id,
			"loser": loser,
			"scores": self.scores
		}
		channel_layer = get_channel_layer()
		if "T_" in self.id:
			# self.game_loop_task_cancel()
			logger.info("GAME ENDED IN TOURNAMENT")
			await channel_layer.group_send(
				self.id,
				{
					"type": "send_game_msg_tour", #function in PongConsumer
					"message": message
				})
			self.game_loop_task_cancel()
		else:
			await self.send_endgame(winner_id, loser)


#########################################################


	@sync_to_async
	def save_game_score(self, winner_id):
		try:
			Game = get_game_model()
			User = get_user_model()
			with transaction.atomic(): #Ensure atomicity
				User = get_user_model()

				winner = User.objects.get(username=winner_id)
				player1 = User.objects.get(username=self.users[0])
				player2 = User.objects.get(username=self.users[1])
				
				score1 = self.scores["player1"]
				score2 = self.scores["player2"]

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
		# logger.info(f"Starting game loop with status: {self.status}")
		try:
			self.start = False
			while True:
				#logger.info(f"Game loop => status: {self.status}")
				if self.status == 0:
					async with self.ball_lock:
						await self.update_ball()
					await self.send_update()
				await asyncio.sleep(0.02)
		except Exception as e:
			logger.error(f"Error in game loop: {e}")


##############################################################

	async def start_game(self, user):
		try: 
			logger.info(f"\033[1;33m{user} is Trying to start the game in room {self.id}\033[0m")
			if self.game_loop_task is None:
				self.status = 1
				# logger.info(f"{user} is starting the countdown")
				await self.send_status(3)
				self.rsg_task = asyncio.create_task(self.ready_steady_go())
				logger.info(f"\033[1;33mThe game has started in room {self.id}\033[0m")
				self.game_loop_task = asyncio.create_task(self.game_loop())
		except Exception as e:
			logger.error(f"Error while trying to start the game: {e}")

	async def stop_game (self):
		logger.info(f"The game has stopped in room {self.id}")
		self.status = 1
		if self.game_loop_task:
			self.game_loop_task_cancel()
			self.game_loop_task = None
		await self.send_status(GameManager.countdown)

#################################################################

	def game_loop_task_cancel(self):
		if self.game_loop_task:
			self.game_loop_task.cancel()
			del self.game_loop_task
			self.game_loop_task = None
			self.status = 1

##################################################################33

	async def leave_room(self, role, user):
		self.users.remove(user)
		logger.info(f"user {user} was removed from active players")
		await self.stop_game()
		await self.start_disconnect_countdown(role)

####################################################################3

	async def send_players_id(self):
		message = {
			"type": "players",
			"player1": self.players["player1"]["id"],
			"player2": self.players["player2"]["id"]
		}
		await self.channel_layer.group_send(
			self.id,
			{
				"type": "send_game_msg", #function in PongConsumer
				"message": message
			})

	async def send_status(self, countdown):
		message = {
			"type": "status",
			"ball": self.ball,
			"players": self.players,
			"scores": self.scores,
			"wait": self.status,
			"countdown": countdown
		}
		await self.channel_layer.group_send(
			self.id,
			{
				"type": "send_game_msg", #function in PongConsumer
				"message": message
			})
		logger.info(f"send_status: {self.players}")
		logger.info("\033[1;35mStatus Sent\033[0m")
	
	async def send_update(self):
		message = {
			"type": "update",
			"ball": self.ball,
			"padS": GameManager.paddle_config["speed"] / GameManager.board_config["height"],
			"players": self.players,
			"scores": self.scores,
			"start": self.start

		}
		await self.channel_layer.group_send(
			self.id,
			{
				"type": "send_game_msg", #function in PongConsumer
				"message": message
			})


	async def send_role(self, channel_name, role):
		logger.info(f"Sending role and GameManager configs")
		message = {
			"type": "role",
			"role": role,
			"canvasX": GameManager.board_config["width"],	# canvas width
			"canvasY": GameManager.board_config["height"],	# canvas height
			"padW": GameManager.paddle_config["width"],	# paddle width
			"padH": GameManager.paddle_config["height"],	# paddle height

			"padS": GameManager.paddle_config["speed"] / GameManager.board_config["height"],	# paddle speed
			"ballRad": GameManager.ball_config["rad"],		# ball radius
			"ballSx": GameManager.ball_config["xspeed"] / GameManager.board_config["width"],	# ball xspeed
			"ballSy": GameManager.ball_config["yspeed"]	/ GameManager.board_config["height"] # ball yspeed

		}
		await self.channel_layer.send(
			channel_name,
			{
				"type": "send_game_msg", # function in PongConsumer
				"message": message
			})


	async def send_endgame(self, winner_id, loser_id):
		logger.info(f"let's send the endgame msg to the consumers")
		logger.info(f"winner: {winner_id} loser: {loser_id}")
		message = {
			"type": "endgame",
			"winner": winner_id,
			"loser": loser_id,
			"scores": self.scores
		}
		try:
			await self.channel_layer.group_send(
				self.id,
				{
					"type": "send_endgame", #function in PongConsumer
					"message": message
				})
			logger.info("\033[1;35mEndgame sent\033[0m")
		except Exception as e:
			logger.error(f"send game error: {e}")

#################################################################

	async def stop_tournament_game(self, winner, loser):
		logger.info(f"STOPPING THE GAME, winner: {winner}, loser: {loser}")
		# if self.player2_waiting_task:
		# 	self.player2_waiting_task.cancel()
		if self.rsg_task:
			self.rsg_task.cancel()
			del self.rsg_task
			self.rsg_task = None
		message = {
			"type": "endgame",
			"winner": winner,
			"loser": loser,
			"scores": {"player1": 0, "player2": 0}
		}
		channel_layer = get_channel_layer()
		if "T_" in self.id:
			# self.game_loop_task_cancel()
			logger.info("GAME ENDED IN TOURNAMENT")
			await channel_layer.group_send(
				self.id,
				{
					"type": "send_game_msg_tour", #function in PongConsumer
					"message": message
				})
			# self.users.remove(loser)
			if self.game_loop_task:
				self.game_loop_task_cancel()
				self.game_loop_task = None
			if self.player2_waiting_task:
				self.player2_waiting_task.cancel()
				self.player2_waiting_task = None

	async def check_unstarted_game(self):
		await asyncio.sleep(10000) #Changeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
		logger.info(f"CHECK UNSTARTED GAME {self.id}")
		logger.info(f"task: {self.player2_waiting_task}")
		logger.info(f"LEN users: {len(self.users)}")
		if len(self.users) != 2:
			logger.info(f"SECOND PLAYER ({self.tour_op}) HAS NOT STARTED")
			await self.stop_tournament_game(self.users[0], self.tour_op)

