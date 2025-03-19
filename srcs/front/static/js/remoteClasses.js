export class Player {
	maxScore = 5;

	constructor(data, canvas, role) {
		// console.log(`Canvas size: ${canvas.width} x ${canvas.height}`)
		this.color = "white";
		this.up = false;
		this.down = false;
		this.score = 0;
		this.canvas = canvas;
		this.whoAmI = null;
		this.y = 0.5;
		this.width = canvas.width * (data.padW / data.canvasX);
		this.height = canvas.height * (data.padH / data.canvasY);
		this.role = role; // "player1" or "player2"
		if (this.role === "player1")
			this.x = 0;
		else
			this.x = canvas.width - this.width;
		this.speed = data.padS;
		this.uplim = this.height / 2;
		this.downlim = this.canvas.height - (this.height / 2)
		// console.log(`Constructor finished, ${this.role},  ${this.whoAmI}`)
	}
 
	setVars(data) {
		this.width = this.canvas.width * data.padW / data.canvasX;
		this.height = this.canvas.height * data.padH / data.canvasY;
		this.speed = data.padS;
	}

	draw(ctx) {
		const topY = this.y * this.canvas.height - this.height / 2;
		ctx.fillStyle = this.color;
		ctx.fillRect(this.x, topY, this.width, this.height);
	}

	move(socket) {
		// console.log(`Moving, uplim is ${this.uplim}, downlim is ${this.downlim}`)
		const oldY = this.y
		const realY = this.y * this.canvas.height
		// console.log(`Current y position: ${this.y}\nCurrent REAL y position ${realY}`);
		if (this.up && realY > this.uplim)
			this.y -= this.speed;
		if (this.down && realY < this.downlim)
			this.y += this.speed;
		if (socket.readyState === WebSocket.OPEN && this.y != oldY) {
			// console.log(`Sending, oldY is ${oldY}, newY is ${this.y}`)
			this.send(socket);
		}
	}

	update(players, newScore) {
		if (!this.role)
			return ;
		const oldY = this.y
		if (players && players[this.role] && players[this.role]["y"])
			this.y = players[this.role]["y"];
		// if (players && oldY != players[this.role]["y"] && this.role == "player1")
			// console.log(`Updating, oldY ${oldY}, newY ${players[this.role]["y"]}`)
		if (newScore[this.role])
			this.score = newScore[this.role];
	}

	drawScore(ctx) {
		const text = this.whoAmI + ": " + this.score;
		let x;
		let fontSize = Math.floor(this.canvas.width * 0.05);
		ctx.fillStyle = "rgb(100, 100, 100 / 50%)";
		ctx.font = `${fontSize}px Arial`;
		if (this.x == 0)
			x = this.canvas.width / 4 - ctx.measureText(text).width / 2;
		else
			x = this.canvas.width * 0.75 - ctx.measureText(text).width / 2;
		ctx.fillText(text, x, this.canvas.height / 10);
	}

	displayEndgameMessage(ctx, oppScore, msg) {
		let div = document.getElementById("wait");
		let fontSize = Math.floor(this.canvas.width * 0.05);

		if (div) {
			if (this.role == "player1")
				div.innerHTML = msg + `<br>${this.score} - ${oppScore}`;
			else
				div.innerHTML = msg + `<br>${oppScore} - ${this.score}`;

			div.style.display = "block";
			ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			ctx.fillStyle = "rgba(0 0 0 / 25%)";
			ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

			div.style.fontSize = Math.floor(this.canvas.width * 0.05) + "px";
			// console.log("endgameMsg: " + msg);
		}
	}

	send(socket) {
		if (socket.readyState === WebSocket.OPEN)
		{
			// console.log(`Sending paddle pos: ${this.y}`)
			const data = {
				"type": "update",
				"role": this.role,
				"y": this.y,
				"score": this.score,
			};
			socket.send(JSON.stringify(data));
		}
	}


	resize(nW, nH) {
		const factor = nH / this.canvas.height;

		this.width = this.width * nW / this.canvas.width;
		this.height = this.height * factor;
		if (this.x != 0)
			this.x = nW - this.width;
		this.y = this.y * factor;
  }
}


export class Ball {
	radFactor = 0.01;

	constructor(canvas) {
		this.canvas = canvas;
		this.x = canvas.width / 2;
		this.y = canvas.height / 2;
		this.color = "white";
	}

	setVars(data) {
		this.radius = this.canvas.width * data.ballRad / data.canvasX;
		this.xspeed = this.canvas.width * data.ballSx / data.canvasX;
		this.yspeed = this.canvas.height * data.ballSy / data.canvasY;
		this.x = this.canvas.width / 2;
		this.y = this.canvas.height / 2;
	}

	draw(ctx) {
		ctx.fillStyle = this.color;
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
		ctx.fill();
	}

	resetPosition() {
		this.x = this.canvas.width / 2;
		this.y = this.canvas.height / 2;
	}

	resize(nW, nH) {
		const factor = nH / this.canvas.height;

		this.radius = this.radius * factor;
		this.x = this.x * nW / this.canvas.width;
		this.y = this.y * factor;

	}
}
