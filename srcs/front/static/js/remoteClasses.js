export class Player {
	maxScore = 5;
	wFactor = 0.03;
	hFactor = 0.1;
	sFactor = 0.02;

	constructor(canvas, role) {
		console.log(`Canvas size: ${canvas.width} x ${canvas.height}`)
		this.width = canvas.width * 0.01;
		this.height = canvas.height * 0.2;
		if (role === "player1")
			this.x = 0;
		else
			this.x = canvas.width - this.width;
		this.y = canvas.height / 2 - this.height / 2;
		this.speed = canvas.height * this.sFactor; // Speed scales with canvas height
		this.color = "white";
		this.up = false;
		this.down = false;
		this.score = 0;
		this.role = role; // "player1" or "player2"
		this.canvas = canvas;
	}
 
	draw(ctx) {
		ctx.fillStyle = this.color;
		ctx.fillRect(this.x, this.y, this.width, this.height);
		//if (this.role === "player1")
		//	console.log("paddles: x " + this.x + "\ny: " + this.y + "\nwidth: " + this.width + "\nheight: " + this.height);
	}

	move(socket) {
		const oldY = this.y
		if (this.up && this.y > 0)
			this.y -= this.speed;
		if (this.down && this.y < (this.canvas.height - this.height))
			this.y += this.speed;
	
		if (socket.readyState === WebSocket.OPEN && this.y != oldY)
			this.send(socket);
	}

	update(newY, newScore) {
		this.y = newY;
		this.score = newScore;
	}

	drawScore(ctx, playerID) {
		let x;
		ctx.fillStyle = "white";
		ctx.font = "40px Arial";
		if (playerID === 1)
			x = this.canvas.width / 4;
		else
			x = this.canvas.width * 3 / 4;
		ctx.fillText(`Score: ${this.score}`, x, 30);
	}

	scored(socket) {
		this.score++;
		this.send(socket);
	}

	displayEndgameMessage(ctx, finalScore, msg) {
		ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
		ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		ctx.fillStyle = "white";
		ctx.font = "50px Arial";
		ctx.textAlign = "center";
		ctx.fillText(msg, this.canvas.width / 2, this.canvas.height / 2 - 20);
		ctx.font = "40px Arial";
		ctx.fillText(finalScore, this.canvas.width / 2, this.canvas.height / 2 + 30);
	}
	send(socket) {
		console.log("I'm sending my role: " + this.role);
		if (socket.readyState === WebSocket.OPEN)
		{
			const data = {
				"type": "update",
				"role": this.role,
				"paddle": this.y,
				"score": this.score,
			};
			socket.send(JSON.stringify(data));
		}
	}
	resize(canvas, wScale, hScale)
	{
		this.width = canvas.width * this.wFactor;
		this.height = canvas.height * this.hFactor;
		if (this.role == "player2")
			this.x = canvas.width - canvas.width * 0.01
		this.x *= wScale;
		this.y *= hScale;
		this.speed = canvas.height * this.sFactor;
		this.canvas = canvas;
	}
}


export class Ball {
	radFactor = 0.01;
	sFactor = 0.01;

	constructor(canvas) {
		this.canvas = canvas;
		this.radius = canvas.width * this.radFactor; // Ball radius scales with canvas width
		this.x = canvas.width / 2;
		this.y = canvas.height / 2;
		this.xspeed = canvas.width * 0.01; // Speed scales with canvas width
		this.yspeed = canvas.height * 0.01; // Speed scales with canvas height
		this.color = "white";
	}

	draw(ctx) {
		//console.log("ball x: " + this.x + " y: " + this.y + " rad: " + this.radius);
		ctx.fillStyle = this.color;
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
		ctx.fill();
	}

	update(newX, newY) {
		// Update ball position from server data
		this.x = newX;
		this.y = newY;
	}

	resetPosition() {
		this.x = this.canvas.width / 2;
		this.y = this.canvas.height / 2;
	}

	move(player, opponent, loopID, socket) {
		this.x += this.xspeed;
		this.y += this.yspeed;

		//Top and bottom wall collision
		if (this.y <= 0 || this.y + this.radius >= this.canvas.height)
			this.yspeed = -this.yspeed;

		//Left paddle (player) collision
		if (this.x <= player.width && this.y + this.radius >= player.y
			&& this.y <= player.y + player.height)
		{
			this.xspeed = -this.xspeed;
			this.send(socket);
		}

		//Right paddle (opponent) collision
		else if (this.x + this.radius >= this.canvas.width - opponent.width
			&& this.y + this.radius >= opponent.y
			&& this.y <= opponent.y + opponent.height)
		{
			this.xspeed = -this.xspeed;
			this.send(socket);
		}

		if (this.x - this.radius <= 0)
		{
			opponent.scored(socket);
			this.resetPosition();
			this.send(socket);
		}
		else if (this.x + this.radius >= this.canvas.width)
		{
			player.scored(socket);
			this.resetPosition();
			this.send(socket);
		}
	}
	send(socket) {
		if (socket.readyState === WebSocket.OPEN)
		{
			const data = {
				"type": "ballUpdate",
				"x": this.x,
				"y": this.y,
				"xspeed": this.xspeed,
				"yspeed": this.yspeed,
			};
			socket.send(JSON.stringify(data));
		}
	}
	resize(canvas, wScale, hScale)
	{
		this.radius = canvas.width * this.radFactor;
		this.x *= wScale;
		this.y *= hScale;
		this.xspeed *= wScale;
		this.yspeed *= hScale;
		this.canvas = canvas;
	}
}
