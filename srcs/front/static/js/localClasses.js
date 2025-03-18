export class Player {

    constructor(canvas, role, name) {
        this.width = canvas.height * 0.0175;
        this.height = canvas.height * 0.175;
        if (!role) {
            this.x = 0
        } else {
            this.x = canvas.width - this.width;
        }
        // console.log(`player width: ${this.x}`)
        this.y = canvas.height / 2 - this.height / 2;
        this.speed = canvas.height * 0.01;
        this.color = "white";   
        this.up = false;
        this.down = false;
        this.score = 0;
        this.role = role; // 1 - right or 0 - left
        this.name = name;
        this.canvas = canvas;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    move() {
        if (this.up && this.y > 0) 
            this.y -= this.speed;
        if (this.down && this.y < this.canvas.height - this.height) 
            this.y += this.speed;
		if (this.y < 0)
			this.y = 0;
		else if (this.y + this.height > this.canvas.height)
			this.y = this.canvas.height - this.height;
    }

    drawScore(ctx) {
		const text = `${this.name}: ${this.score}`;
		let x;
        ctx.fillStyle = 'white';
        ctx.font = Math.floor(this.canvas.width * 0.04) + "px Arial";
        if (this.role === 0) {
			x = this.canvas.width / 4 - ctx.measureText(text).width / 2;
        } else {
			x = this.canvas.width * 0.75 - ctx.measureText(text).width / 2;
        }
        ctx.fillText(text, x, this.canvas.height / 10);
    }

    scored() {
        this.score++;
    }

	displayEndgameMessage(ctx, finalScore, msg) {
		let div = document.getElementById("wait");
		let fontSize = Math.floor(this.canvas.width * 0.05);

		div.innerHTML = msg + `<br>${finalScore}`;
		div.style.display = "block";
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		ctx.fillStyle = "rgba(0 0 0 / 25%)";
		ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		div.style.fontSize = Math.floor(this.canvas.width * 0.05) + "px";
	}

	resetPosition() {
		this.y = (this.canvas.height - this.height) / 2;
	}

    resize(nW, nH) {
		const factor = nH / this.canvas.height;

		this.width = this.width * nW / this.canvas.width;
		this.height = this.height * factor;
		if (this.x != 0)
			this.x = nW - this.width;
		this.y = this.y * factor;
        this.speed = this.speed * factor;
  }
}

export class Ball {

    constructor(canvas, ctx) {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.xspeed = canvas.height * 0.01;
        this.yspeed = canvas.height * 0.0125;
        // this.yspeed = 0;
        this.color = "white";
        this.canvas = canvas;
        this.radius =  canvas.height * 0.02;
		this.ctx = ctx;
    }

    draw() {
       this.ctx.fillStyle = this.color;
       this.ctx.beginPath();
       this.ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
       this.ctx.fill();
    }

    resetPosition() {
        this.x = this.canvas.width / 2;
        this.y = this.canvas.height / 2;
        this.xspeed = -this.xspeed; // Alternate serve direction
    }

	move(player1, player2) {
   		this.x += this.xspeed;
   		this.y += this.yspeed;

        // Top and bottom wall collision
        if (this.y - this.radius <= 0 || this.y + this.radius >= this.canvas.height)
            this.yspeed = -this.yspeed;
   		// Player 1 paddle collision
   		if (
   		    this.x - this.radius <= player1.x + player1.width &&
   		    this.x - this.radius >= player1.x &&
   		    this.y >= player1.y &&
   		    this.y <= player1.y + player1.height
   		) {
   		    this.xspeed = Math.abs(this.xspeed);
   		    this.x = player1.x + player1.width + this.radius;
   		}

   		// Player 2 paddle collision
   		if (
   		    this.x + this.radius >= player2.x &&
   		    this.x + this.radius <= player2.x + player2.width &&
   		    this.y >= player2.y &&
   		    this.y <= player2.y + player2.height
   		) {
   		    this.xspeed = -this.xspeed;
   		    this.x = player2.x - this.radius;
   		}


   		// Scoring conditions
   		if (this.x - this.radius <= 0) {
   		    player2.scored();
   		    player2.resetPosition();
   		    player1.resetPosition();
   		    this.resetPosition();
   		    return 1;
   		} else if (this.x + this.radius >= this.canvas.width) {
   		    player1.scored();
   		    player1.resetPosition();
   		    player2.resetPosition();
   		    this.resetPosition();
   		    return 1;
   		}

   		return 0;
	}

    resize(nW, nH) {
		const factor = nH / this.canvas.height;         // Factor vertical
    const factorX = nW / this.canvas.width;           // Factor horizontal

    // Escalamos posición y tamaño
    this.radius = this.radius * factor;
    this.x = this.x * factorX;
    this.y = this.y * factor;

    // Escalamos las velocidades de forma proporcional
    this.xspeed = this.xspeed * factorX;
    this.yspeed = this.yspeed * factor;

	}
}
