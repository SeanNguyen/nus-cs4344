/*
 * Client.js
 * Implementation of a non-Bot game client in Space Battle.
 * Assignment 3 for CS4344, AY2014/15.
 *
 * Usage in a HTML file: 
 *     <body onload="loadScript('', 'Client.js')"> 
 */
"use strict"; 
var nextRoom = [{"up":3, "down":3, "left":1, "right":1},
{"up":2, "down":2, "left":0, "right":0},
{"up":1, "down":1, "left":3, "right":3},
{"up":0, "down":0, "left":2, "right":2}];
function Client(serverId) {
    var sock;          // socket to server
    var ships = {};    // associative array of ships, indexed by ship ID
    var rockets = {};  // associative array of rockets, indexed by rocket ID
    var myShip;        // my ship object  (same as ships[myId])
    var myId;          // My ship ID

    var serverIndex = serverId;
    var newPos;
    var that = this;
    var dd;

    var aoi;            //AOI data

    /*
     * private method: sendToServer(msg)
     *
     * The method takes in a JSON structure and send it
     * to the server, after converting the structure into
     * a string.
     */
    var sendToServer = function (msg) {
        console.log("send-> " + JSON.stringify(msg));
        sock.send(JSON.stringify(msg));
    }

    /*
     * priviledge method: run()
     *
     * The method is called to initialize and run the client.
     * It connects to the server via SockJS (so, run
     * "node MMOServer.js" first) and set up various 
     * callbacks.
     *
     */
    this.run = function() {
        sock = new SockJS('http://' + Config.SERVER_NAME + ':' + (Config.PORT + serverIndex)+ '/space');
        console.log("Connect to server: "+serverIndex);
        sock.onmessage = function(e) {
        var message = JSON.parse(e.data);
            
            switch (message.type) {
                case "join": 
                    // Server agrees to let this client join.
                    myId = message.id;
                    ships[myId] = new Ship();
                    myShip = ships[myId];
                    myShip.init(message.x, message.y, message.dir);

                    // Start the game loop
                    setInterval(function() {gameLoop();}, 1000/Config.FRAME_RATE); 
                    break;
                case "new":
                    // Add a ship to the battlefield.
                    var id = message.id;
                    ships[id] = new Ship();
                    ships[id].init(message.x, message.y, message.dir);
                    break;
                case "turn":
                    // Ship id just turned to dir at position (x,y)
                    var id = message.id;
                    if (ships[id] === undefined) {
                        console.log("turn error: undefined ship " + id);
                    } else {
                        // We do zero-order convergence for simplicity here.
                        ships[id].jumpTo(message.x, message.y);
                        ships[id].turn(message.dir);
                    }
                    break;
                case "fire":
                    // Ship sid just fired a rocket rid in dir 
                    // at position (x,y)
                    var sid = message.ship;
                    var rid = message.rocket;
                    if (ships[sid] === undefined) {
                        console.log("fire error: undefined ship " + sid);
                    } 
                    var r = new Rocket();
                    r.init(message.x, message.y, message.dir, sid);
                    rockets[rid] = r;
                    break;
                case "hit":
                    // Rocket rid just hit Ship rid
                    var sid = message.ship;
                    var rid = message.rocket;
                    if (ships[sid] === undefined) {
                        console.log("hit error: undefined ship " + sid);
                    } else {
                        // If this client has been hit, increase hit count
                        ships[sid].hit();
                        if (sid == myId) {
                            showMessage("hitCount", myShip.hitCount);
                        }
                    }
                    if (rockets[rid] === undefined) {
                        console.log("hit error: undefined rocket " + rid);
                    } else {
                        // If it is this client's rocket that hits, increase kill count
                        ships[rockets[rid].from].kill();
                        if (rockets[rid].from == myId) {
                            showMessage("killCount", myShip.killCount);
                        }
                        // Remove the rocket
                        delete rockets[rid];
                    }
                    break;
                case "delete":
                    // Ship ID has quit. Remove the ship from the battle.
                    var id = message.id;
                    if (ships[id] === undefined) {
                        console.log("delete error: undefined ship " + id);
                    } else {
                        delete ships[id];
                    }
                    break;
                case "aoi":
                    // visualize AOI
                    aoi = message.cellIndexes;
                    break;
                default:
                    console.log("error: undefined command " + message.type);
            }
        };

        sock.onclose = function() {
            // Connection to server has closed.  Delete everything.
            for (var i in ships) {
                delete ships[i];
            }
            for (var i in rockets) {
                delete rockets[i];
            }
        }

        sock.onopen = function() {
            // When connection to server is open, ask to join.

            sendToServer({type:"join", position: newPos, dir: dd});
            
            //sendToServer({type: "aoi"});

        }


        // Setup the keyboard input.  User controls the game with
        // arrow keys and space bar.
        var c = document.getElementById("canvas");
        c.height = Config.HEIGHT;
        c.width= Config.WIDTH;

        document.addEventListener("keydown", function(e) {
            if (myShip === undefined) {
                // if myShip is not created yet (e.g., still
                // waiting for join permission from server), 
                // quitely returned.
                return;
            }
            // We short-circuit turn, but not fire.  
            if (e.keyCode == 37) { 
                myShip.turn("left");
                sendToServer({
                    type:"turn", 
                    x: myShip.x, 
                    y: myShip.y, 
                    dir:"left"});
           
            } else if (e.keyCode == 38) { 
                myShip.turn("up");
                sendToServer({
                    type:"turn", 
                    x: myShip.x, 
                    y: myShip.y, 
                    dir:"up"});
            } else if (e.keyCode == 39) {
                myShip.turn("right");
                sendToServer({
                    type:"turn", 
                    x: myShip.x, 
                    y: myShip.y, 
                    dir:"right"});
            } else if (e.keyCode == 40) {
                myShip.turn("down");
                sendToServer({
                    type:"turn", 
                    x: myShip.x, 
                    y: myShip.y, 
                    dir:"down"});
            } else if (e.keyCode == 32) { // space
                sendToServer({
                    type:"fire",
                    x: myShip.x, 
                    y: myShip.y, 
                    dir: myShip.dir});
            }
            if ((e.keyCode >= 37 && e.keyCode <= 40) || e.keyCode == 32) {
                e.preventDefault();
            }
        }, false);

    }

    /*
     * priviledge method: gameLoop()
     *
     * Calculate the movement of every ship and rocket.
     * Remove out-of-bound rocket, then render the whole
     * battle field.
     *
     */
    var gameLoop = function() {
        for (var i in ships) {
            //If Ships move out of bound, close socket, join next Room correspondingly
            var lastX = ships[i].x;
            var lastY = ships[i].y;

            ships[i].moveOneStep();
            var curX = ships[i].x;
            var curY = ships[i].y;

            if (ships[i].dir == "left" || ships[i].dir == "right"){
                if (((lastX < Config.WIDTH/2) && (Config.WIDTH/2 < curX)) || ((lastX > Config.WIDTH/2) && (Config.WIDTH/2 > curX))) {
                    var nextRm = nextRoom[serverIndex][ships[i].dir];
                    serverIndex = nextRm; 
                    sock.close();
                    newPos = {x:ships[i].x, y:ships[i].y, dir:ships[i].dir};
                    that.run();    
                }

            }else if (ships[i].dir == "up" || ships[i].dir == "down"){
                if (((lastY < Config.HEIGHT/2) && (Config.HEIGHT/2 < curY)) || ((lastY > Config.HEIGHT/2) && (Config.HEIGHT/2 > curY))) {
                    var nextRm = nextRoom[serverIndex][ships[i].dir];
                    serverIndex = nextRm; 
                    sock.close();
                    newPos = {x:ships[i].x, y:ships[i].y, dir:ships[i].dir};
                    that.run();    
                }
            }
            // if(ships[i].moveToAnotherRegion()) {

                // console.log("TATDA");
                // var nextRm = nextRoom[serverIndex][ships[i].dir];
                // serverIndex = nextRm;
                // if(ships[i].x >= Config.WIDTH){
                //     newPos = {x:ships[i].x-Config.WIDTH, y:ships[i].y};        
                // }else if(ships[i].x <= 0){
                //     newPos = {x:ships[i].x+Config.WIDTH, y:ships[i].y};
                // }else if(ships[i].y >= Config.HEIGHT){
                //     newPos = {x:ships[i].x, y:ships[i].y-Config.HEIGHT};
                // }else if(ships[i].y <= 0){
                //     newPos = {x:ships[i].x-Config.WIDTH, y:ships[i].y+Config.HEIGHT};
                // }

                // sock.close();
                // that.run();    

            // }else{
               // ships[i].moveOneStep();
            // }
        }
        
        // remove out-of-bound rockets
        for (var i in rockets) {
            rockets[i].moveOneStep();
            if (rockets[i].x < 0 || rockets[i].x > Config.WIDTH ||
                rockets[i].y < 0 || rockets[i].y > Config.HEIGHT) {
                rockets[i] = null;
                delete rockets[i];
            }
        }
        render();
    }


    /*
     * priviledge method: render()
     *
     * Draw every ship and every rocket in the battlefield.
     *
     */
    var render = function() {
        // Get context
        var c = document.getElementById("canvas");
        var context = c.getContext("2d");

        // Clears the playArea
        context.clearRect(0, 0, Config.WIDTH, Config.HEIGHT);

        context.fillStyle = "#000000";
        context.fillRect(0, 0, Config.WIDTH, Config.HEIGHT);

        //TEST
        //draw aoi
        drawAoi(context);
        //draw grid
        drawGrid(context);

        // Draw the ship
        for (var i in ships) {
            if (ships[i] === myShip) {
                ships[i].draw(context, true);
            } else {
                ships[i].draw(context, false);
            }
        }
        
        // Draw the rocket
        for (var i in rockets) {
            if (rockets[i].from == myId)
                rockets[i].draw(context, true);
            else
                rockets[i].draw(context, false);
        }
    }

    /*
     * private method: showMessage(location, msg)
     *
     * Display a text message on the web page.  The 
     * parameter location indicates the class ID of
     * the HTML element, and msg indicates the message.
     *
     * The new message replaces any existing message
     * being shown.
     */
    var showMessage = function(location, msg) {
        document.getElementById(location).innerHTML = msg; 
    }

    var drawAoi = function (context) {
        if (!aoi) {
            return;
        }
        var cellSize = Config.WIDTH / Config.GRID_WIDTH;
        context.fillStyle = "#b8dbd3";
        for (var i = 0; i < aoi.length; i++) {
            var cellIndex = aoi[i];
            var row = getRowFromCellIndex(cellIndex);
            var col = getColFromCellIndex(cellIndex);
            context.beginPath();
            context.moveTo(col * cellSize, row * cellSize);
            context.lineTo(col * cellSize, row * cellSize + cellSize);
            context.lineTo(col * cellSize + cellSize, row * cellSize + cellSize);
            context.lineTo(col * cellSize + cellSize, row * cellSize);
            context.lineTo(col * cellSize, row * cellSize);
            context.closePath();
            context.fill();
        };
    }

    var drawGrid = function (context) {
        context.beginPath();
        //10px per grid
        var i;
        for (i = 1; i < Config.GRID_WIDTH; i++) {
            context.moveTo(0, i * Config.WIDTH / Config.GRID_WIDTH);
            context.lineTo(Config.WIDTH, i * Config.WIDTH / Config.GRID_WIDTH);
        }
        for (i = 1; i < 100; i++) {
            context.moveTo(i * Config.HEIGHT / Config.GRID_HEIGHT, 0);
            context.lineTo(i * Config.HEIGHT / Config.GRID_HEIGHT, Config.HEIGHT);
        }
        context.strokeStyle="#468499";
        context.stroke();
    }

    var getRowFromCellIndex = function(cellIndex) {
        return Math.floor(cellIndex / Config.GRID_WIDTH);
    }

    var getColFromCellIndex = function(cellIndex) {
        return cellIndex % Config.GRID_WIDTH;
    }
}

var c = new Client(0);
c.run()

// vim:ts=4:sw=4:expandtab
