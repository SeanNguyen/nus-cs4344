/*
 * MMOServer.js
 * A skeleton server for massively multiplayer space battle.
 * Assignment 3 for CS4344, AY2013/14.
 *
 * Usage: 
 *   node MMOServer.js
 */

"use strict"; 

var LIB_PATH = "./";
require(LIB_PATH + "Config.js");
require(LIB_PATH + "Ship.js");
require(LIB_PATH + "Rocket.js");
require(LIB_PATH + "Player.js");

function MMOServer() {
    // private Variables
    var nextPID = 0;  // PID to assign to next connected player 
    var ships = {};   // Associative array for ships, indexed via player ID
    var rockets = {}; // Associative array for rockets, indexed via timestamp
    var sockets = {}; // Associative array for sockets, indexed via player ID
    var players = {}; // Associative array for players, indexed via socket ID
    var shipAoiCaches = {};
    var cells = new Array(Config.GRID_WIDTH * Config.GRID_HEIGHT);

    /*
     * private method: broadcast(msg)
     *
     * broadcast takes in a JSON structure and send it to
     * all players.
     *
     * e.g., broadcast({type: "abc", x: 30});
     */
    var broadcast = function (msg) {
        var id;
        for (id in sockets) {
            sockets[id].write(JSON.stringify(msg));
        }
    }

    /*
     * private method: broadcastUnless(msg, id)
     *
     * broadcast takes in a JSON structure and send it to
     * all players, except player id
     *
     * e.g., broadcast({type: "abc", x: 30}, pid);
     */
    var broadcastUnless = function (msg, pid) {
        var id;
        for (id in sockets) {
            if (id != pid)
                sockets[id].write(JSON.stringify(msg));
        }
    }

    /*
     * private method: unicast(socket, msg)
     *
     * unicast takes in a socket and a JSON structure 
     * and send the message through the given socket.
     *
     * e.g., unicast(socket, {type: "abc", x: 30});
     */
    var unicast = function (socket, msg) {
        socket.write(JSON.stringify(msg));
    }

    /*
     * private method: newPlayer()
     *
     * Called when a new connection is detected.  
     * Create and init the new player.
     */
    var newPlayer = function (conn) {
        nextPID ++;
        // Create player object and insert into players with key = conn.id
        players[conn.id] = new Player();
        players[conn.id].pid = nextPID;
        sockets[nextPID] = conn;
    }

    /*
     * private method: gameLoop()
     *
     * The main game loop.  Called every interval at a
     * period roughly corresponding to the frame rate 
     * of the game
     */
    var gameLoop = function () {
        var i;
        var  j;
        for (i in ships) {
            var cellBeforeMove = getCellIndexByXy(ships[i].x, ships[i].y);
            ships[i].moveOneStep();
            var cellAfterMove = getCellIndexByXy(ships[i].x, ships[i].y);
            //if ship change cell then update group
            if (cellAfterMove !== cellBeforeMove) {
                changeShipCell(i, cellBeforeMove, cellAfterMove);
            }
        }
        for (i in rockets) {
            rockets[i].moveOneStep();
            // remove out of bounds rocket
            if (rockets[i].x < 0 || rockets[i].x > Config.WIDTH ||
                rockets[i].y < 0 || rockets[i].y > Config.HEIGHT) {
                rockets[i] = null;
                delete rockets[i];
            } else {
                // For each ship, checks if this rocket has hit the ship
                // A rocket cannot hit its own ship.
                for (j in ships) {
                    if (rockets[i] != undefined && rockets[i].from != j) {
                        if (rockets[i].hasHit(ships[j])) {
                            // tell everyone there is a hit
                            broadcast({type:"hit", rocket:i, ship:j})
                            delete rockets[i];
                        }
                    } 
                }
            }
        }
    }

    //Grid system: 70x100 saved in 1D array
    var preCalculateAoI = function() {
        var i, j;
        for (i = 0; i < Config.GRID_HEIGHT; i++) {
            for (j = 0; j < Config.GRID_WIDTH; j++) {
                //calculate
                var nimbus = [];
                var row, col;
                //set area 5x5 around the considered grid
                var halfSquare = Math.floor(Config.AOI_SQUARE_SIZE / 2);
                for (row = i - halfSquare; row <= i + halfSquare; row++) {
                    for (col = j - halfSquare; col <= j + halfSquare; col++) {
                        if (row >= 0 && row < Config.GRID_HEIGHT && col >= 0 && col < Config.GRID_WIDTH) {
                            nimbus.push({row: row, col: col});
                        }
                    }
                }
                //set area 3x31
                var halfCrossHeight = Math.floor(Config.AOI_CROSS_SIZE1);
                var halfCrossWidth = Math.floor(Config.AOI_CROSS_SIZE2);
                for (row = i - halfCrossHeight; row <= i + halfCrossHeight; row++) {
                    for (col = j - halfCrossWidth; col <= j + halfCrossWidth; col++) {
                        if (row >= 0 && row < Config.GRID_HEIGHT && col >= 0 && col < Config.GRID_WIDTH) {
                            nimbus.push({row: row, col: col});
                        }
                    }
                }
                //set area 31x3
                var halfCrossHeight = Math.floor(Config.AOI_CROSS_SIZE2);
                var halfCrossWidth = Math.floor(Config.AOI_CROSS_SIZE1);
                for (row = i - halfCrossHeight; row <= i + halfCrossHeight; row++) {
                    for (col = j - halfCrossWidth; col <= j + halfCrossWidth; col++) {
                        if (row >= 0 && row < Config.GRID_HEIGHT && col >= 0 && col < Config.GRID_WIDTH) {
                            nimbus.push({row: row, col: col});
                        }
                    }
                }
                //add to communicationGroups
                nimbuses.push(nimbus);
            }
        }
    }

    /*
     * priviledge method: start()
     *
     * Called when the server starts running.  Open the
     * socket and listen for connections.  Also initialize
     * callbacks for socket.
     */
    this.start = function () {
        try {
            initCells();
            var express = require('express');
            var http = require('http');
            var sockjs = require('sockjs');
            var sock = sockjs.createServer();

            // Upon connection established from a client socket
            sock.on('connection', function (conn) {
                newPlayer(conn);

                // When the client closes the connection to the 
                // server/closes the window
                conn.on('close', function () {
                    var pid = players[conn.id].pid;
                    delete ships[pid];
                    delete players[conn.id];
                    broadcastUnless({
                        type: "delete", 
                        id: pid}, pid)
                });

                // When the client send something to the server.
                conn.on('data', function (data) {
                    var message = JSON.parse(data)
                    var p = players[conn.id];
                    if (p === undefined) {
                        // we received data from a connection with
                        // no corresponding player.  don't do anything.
                        console.log("player at " + conn.id + " is invalid."); 
                        return;
                    } 
                    switch (message.type) {
                        case "join":
                            // A client has requested to join. 
                            // Initialize a ship at random position
                            // and tell everyone.
                            var pid = players[conn.id].pid;
                            var x = Math.floor(Math.random()*Config.WIDTH);
                            var y = Math.floor(Math.random()*Config.HEIGHT);
                            var dir;
                            var dice = Math.random();
                            // pick a dir with equal probability
                            if (dice < 0.25) {
                                dir = "right";
                            } else if (dice < 0.5) {
                                dir = "left";
                            } else if (dice < 0.75) {
                                dir = "up";
                            } else {
                                dir = "down";
                            }
                            ships[pid] = new Ship();
                            ships[pid].init(x, y, dir);
                            broadcastUnless({
                                type: "new", 
                                id: pid, 
                                x: x,
                                y: y,
                                dir: dir}, pid)
                            unicast(sockets[pid], {
                                type: "join",
                                id: pid,
                                x: x,
                                y: y,
                                dir: dir});   
                            
                            // Tell this new guy who else is in the game.
                            for (var i in ships) {
                                if (i != pid) {
                                    if (ships[i] !== undefined) {
                                        unicast(sockets[pid], {
                                            type:"new",
                                            id: i, 
                                            x: ships[i].x, 
                                            y: ships[i].y, 
                                            dir: ships[i].dir});   
                                    }
                                }
                            }
                            break;

                        case "turn":
                            // A player has turned.  Tell everyone else.
                            var pid = players[conn.id].pid;
                            ships[pid].jumpTo(message.x, message.y);
                            ships[pid].turn(message.dir);
                            broadcastUnless({
                                type:"turn",
                                id: pid,
                                x: message.x, 
                                y: message.y, 
                                dir: message.dir
                            }, pid);
                            break;

                        case "fire":
                            // A player has asked to fire a rocket.  Create
                            // a rocket, and tell everyone (including the player, 
                            // so that it knows the rocket ID).
                            var pid = players[conn.id].pid;
                            var r = new Rocket();
                            r.init(message.x, message.y, message.dir, pid);
                            var rocketId = new Date().getTime();
                            rockets[rocketId] = r;
                            broadcast({
                                type:"fire",
                                ship: pid,
                                rocket: rocketId,
                                x: message.x,
                                y: message.y,
                                dir: message.dir
                            });
                            break;
                            
                        default:
                            console.log("Unhandled " + message.type);
                    }
                }); // conn.on("data"
            }); // socket.on("connection"

            // cal the game loop
            setInterval(function() {gameLoop();}, 1000/Config.FRAME_RATE); 

            // Standard code to start the server and listen
            // for connection
            var app = express();
            var httpServer = http.createServer(app);
            sock.installHandlers(httpServer, {prefix:'/space'});
            httpServer.listen(Config.PORT, Config.SERVER_NAME);
            app.use(express.static(__dirname));
            console.log("Server running on http://" + Config.SERVER_NAME + 
                    ":" + Config.PORT + "\n")
            console.log("Visit http://" + Config.SERVER_NAME + ":" + Config.PORT + "/index.html in your browser to start the game")
        } catch (e) {
            console.log("Cannot listen to " + Config.PORT);
            console.log("Error: " + e);
        }
    }

    //helper methods
    var initCells = function() {
        for (var i = cells.length - 1; i >= 0; i--) {
            cells[i] = [];
        };
    }

    var getCellIndexByXy = function (x, y) {
        var row = Math.floor(y / (Config.HEIGHT / Config.GRID_HEIGHT));
        var col = Math.floor(x / (Config.WIDTH / Config.GRID_WIDTH));
        return getCellIndex(row, col);
    }

    var getCellIndex = function (row, col) {
        return row * Config.GRID_WIDTH + col;
    }

    var changeShipCell = function(pid, oldCellIndex, newCellIndex) {
        //unsub old cell
        //check if is there pre-calculated data for AOI
        var oldAoiCells = getShipAoi(oldCellIndex);
        for (var i = oldAoiCells.length - 1; i >= 0; i--) {
            var cellIndex = oldAoiCells[i];
            var cell = cells[cellIndex];
            for (var j = cell.length - 1; j >= 0; j--) {
                if (cell[j] === pid) {
                    delete cell[j];
                }
            };
        };

        //sub new cell
        var newAoiCells = getShipAoi(newCellIndex);
        for (var i = newAoiCells.length - 1; i >= 0; i--) {
            var cellIndex = newAoiCells[i];
            var cell = cells[cellIndex];
            cell.push(pid);
        };
    }

    var getShipAoi = function (cellIndex) {
        if (shipAoiCaches[cellIndex]) {
            return shipAoiCaches[cellIndex];
        } else {
            var results = [];
            var row = getRowFromCellIndex(cellIndex);
            var col = getColFromCellIndex(cellIndex);
            var halfHeight = Math.floor(Config.AOI_CROSS_SIZE1);
            var halfWidth = Math.floor(Config.AOI_CROSS_SIZE2);
            var i,j;
            for (i = row - halfHeight; i <= row + halfHeight; i++) {
                for (j = col - halfWidth; j <= col + halfWidth; j++) {
                    if (i >= 0 && i < Config.GRID_HEIGHT && j >= 0 && j < Config.GRID_WIDTH) {
                        results.push(getCellIndex(i, j));
                    }
                }
            }
            halfHeight = Math.floor(Config.AOI_CROSS_SIZE1);
            halfWidth = Math.floor(Config.AOI_CROSS_SIZE2);
            for (i = row - halfHeight; i <= row + halfHeight; i++) {
                for (j = col - halfWidth; j <= col + halfWidth; j++) {
                    if (i >= 0 && i < Config.GRID_HEIGHT && j >= 0 && j < Config.GRID_WIDTH) {
                        results.push(getCellIndex(i, j));
                    }
                }
            }
            shipAoiCaches[cellIndex] = results;
            return results;
        }
    }

    var getRowFromCellIndex = function(cellIndex) {
        return Math.floor(cellIndex / Config.GRID_WIDTH);
    }

    var getColFromCellIndex = function(cellIndex) {
        return cellIndex % Config.GRID_HEIGHT;
    }
}

// This will auto run after this script is loaded
var server = new MMOServer();
server.start();

// vim:ts=4:sw=4:expandtab
