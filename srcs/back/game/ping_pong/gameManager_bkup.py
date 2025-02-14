from collections import defaultdict
import logging
import asyncio

logger = logging.getLogger(__name__)

# games -> array that stores all the current games' info
'''
games[roomID] structure:
	- players
		L player1
			L id [int]	#username
			L y	 [int]	#paddle's y coord
		L player2
			L id [int]
			L y  [int]
	- ball
		L x		 [int]	#ball's x coord
		L y		 [int]	#ball's y coord
		L xspeed [int]	#ball's speed: x component
		L yspeed [int]	#ball's speed: y component
	- scores
		L player1 [int]
		L player2 [int]
	- gameLoopRunning	[bool] is gameLoopRunning... running?
'''

class GameManager:
	PADDLE_HEIGHT = 80
	BOARD_WIDTH = 1200
	BOARD_HEIGHT = 600
	BALL_SPEED = 5
	COUNTDOWN = 10 #seconds a player can be disconnected before losing

	# Store all games
	games = {}
	disconnect_tasks = {}

	@classmethod
	def isGameLoopRunning(cls, roomID):
		return cls.games.get(roomID, {}).get("game_loop_running", False)

	@classmethod
	def setGameLoopRunning(cls, roomID, running):
		if roomID in cls.games:
			cls.games[roomID]["game_loop_running"] = running

	#@classmethod
	#def isRoomEmpty(cls, roomID):
	#	return roomID not in cls.games or not cls.games[roomID]["players"]

	@classmethod
	def joinRoom(cls, roomID, player_id):
		game = cls.games.setdefault(roomID, {
			"players": {},
			"ball": {"x": 400, "y": 250, "xspeed": cls.BALL_SPEED, "yspeed": cls.BALL_SPEED},
			"scores": {"player1": 0, "player2": 0},
			"game_loop_running": False
		})

		logger.info(f"\033[1;31mJOIN ROOM: game[players] = {game['players']}\033[0m")
		try:
			if game["players"]:
				player1 = game["players"].get("player1")
				player2 = game["players"].get("player2")
				if player1 and (player_id == player1["id"]):
					return "player1"
				elif player2 and (player_id == player2["id"]):
					return "player2"

				if len(game["players"]) >= 2:  # Max 2 players
					logger.info(f"\033[1;33mI'm FUCKING FULL\033[0m")
					return None  # Room is full
		except Exception as e:
			logger.info(str(e))

		role = "player1" if "player1" not in game["players"] else "player2"
		logger.info(f"\033[1;33mjoinRoom game->players {game['players']}\033[0m")
		game["players"][role] = {"id": player_id, "y": 250}  # Initial paddle position
		return role

	@staticmethod
	def leaveRoom(roomID, player_id):
		game = GameManager.games.get(roomID)
		if not game:
			return

		for role, player in list(game["players"].items()):
			if player["id"] == player_id:
				del game["players"][role]
				logger.info(f"Player {role} left room {roomID}.")
				break

		if not game["players"]:  # Delete room if empty
			del GameManager.games[roomID]
			logger.info(f"Room {roomID} has been deleted.")

	@staticmethod
	def updateBallPos(game):
		ball = game["ball"]
		ball["x"] += ball["xspeed"]
		ball["y"] += ball["yspeed"]

		players = game["players"]

		# Paddle collisions
		if ball["x"] <= 20 and GameManager.isBallWithinPaddle(ball["y"], players.get("player1")):
			ball["xspeed"] *= -1
		elif ball["x"] >= GameManager.BOARD_WIDTH - 20 and GameManager.isBallWithinPaddle(ball["y"], players.get("player2")):
			ball["xspeed"] *= -1

		# Wall collisions
		if ball["y"] <= 0 or ball["y"] >= GameManager.BOARD_HEIGHT:
			ball["yspeed"] *= -1

		# Scoring
		if ball["x"] <= 0:  # Left wall
			game["scores"]["player2"] += 1
			GameManager.resetBall(ball, direction=1)
		elif ball["x"] >= GameManager.BOARD_WIDTH:  # Right wall
			game["scores"]["player1"] += 1
			GameManager.resetBall(ball, direction=-1)

	@staticmethod
	def isBallWithinPaddle(ball_y, paddle):
		if not paddle:
			return False
		return paddle["y"] <= ball_y <= paddle["y"] + GameManager.PADDLE_HEIGHT

	@staticmethod
	def resetBall(ball, direction):
		ball.update({"x": 400, "y": 250, "xspeed": GameManager.BALL_SPEED * direction, "yspeed": GameManager.BALL_SPEED})

	@staticmethod
	def handleMessage(roomID, role, data):
		game = GameManager.games.get(roomID)
		if not game:
			return {"type": "error", "message": "Game not found"}
		if data["type"] == "update":
			if (role == data["role"]) and (role in game["players"]):
				game["players"][role]["y"] = data["paddle"]
			game["scores"][data["role"]] = data["score"]
		elif data["type"] == "ballUpdate":
			ball = game["ball"]
			ball["x"] = data["x"]
			ball["y"] = data["y"]
			ball["xspeed"] = data["xspeed"]
			ball["yspeed"] = data["yspeed"]

		return {
			"type": "update",
			"ball": game["ball"],
			"scores": game["scores"],
			"players": {
				role: {"y": player["y"]} for role, player in game["players"].items()
			},
		}

	@staticmethod
	def declare_winner(roomID, winner_id, role):
		logger.info("let's declare the winner")
		game = GameManager.games.get(roomID)
		if not game:
			return
	
		logger.info(f"Player {winner_id} wins in room {roomID}!")
		return {
			"type": "endgame",
			"wait": 1,
			"winnerId": winner_id,
			"loserRole": role,
			"scores": game["scores"]
		}
	
	@staticmethod
	def cancel_disconnect_task(roomID):
		task = GameManager.disconnect_tasks.get(roomID)
		if task:
			task.cancel()
			del GameManager.disconnect_tasks[roomID]

	@staticmethod
	async def start_disconnect_countdown(roomID, remaining_player_id, role):
		async def countdown():
			try:
				logger.info(f"\033[1;31mPre-countdown: {GameManager.COUNTDOWN}")
				await asyncio.sleep(GameManager.COUNTDOWN)
				logger.info(f"\033[1;31mPost-countdown")
				msg = GameManager.declare_winner(roomID, remaining_player_id, role)
				logger.info(f"\033[1;34m{msg}\033[0;m");
				return msg
			except asyncio.CancelledError:
				logger.info(f"Disconnect countdown cancelled for room {roomID}")
				return None
		if roomID in GameManager.disconnect_tasks:
			logger.warning(f"Countdown task already exists for room {roomID}. Overwriting previous task.")
		task = asyncio.create_task(countdown())
		GameManager.disconnect_tasks[roomID] = task
		result = await task
		logger.info(f"winner_msg: {result}");
		return result
