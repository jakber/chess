var express = require('express');
var app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server)
  , _ = require('underscore')

server.listen(8080);

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

app.use(express.static(__dirname))

var Piece = function(color, role, startingSquare) {
    this.color = color;
    this.role = role;
    this.startingSquare = startingSquare;
    return this;
}
var homeRow = function(color, row) {
    return [
        new Piece(color, "rook", [row, 0]),
        new Piece(color, "knight", [row, 1]),
        new Piece(color, "bishop", [row, 2]),
        new Piece(color, "queen", [row, 3]),
        new Piece(color, "king", [row, 4]),
        new Piece(color, "bishop", [row, 5]),
        new Piece(color, "knight", [row, 6]),
        new Piece(color, "rook", [row, 7]),
    ];      
}
var pawnRow = function(color, row) {
    return _(8).times(function(col) {
        return new Piece(color, "pawn", [row, col]);
    });
}

var emptyRow = function(row) {
    return _(8).times(function(col) {
        return new Piece("empty", null, [row, col]);
    });
}

var board = null;
var turn = null;

var reset = function() {
    board = [
        homeRow("black", 0), pawnRow("black", 1), 
        emptyRow(2),emptyRow(3),emptyRow(4),emptyRow(5),
        pawnRow("white", 6), homeRow("white", 7)
    ];
    turn = "white";
}
var moveLikeARook = function(from,to) {
    if (from[0] == to[0]) {
        var direction = to[1] > from[1] ? 1 : -1;
        for (square = from[1] + direction; square != to[1]; square += direction) {
            if (board[from[0]][square].color != "empty") return false;
        }
    } else if (from[1] == to[1]) {
        var direction = to[0] > from[0] ? 1 : -1;
        for (square = from[0] + direction; square != to[0]; square += direction) {
            if (board[square][from[1]].color != "empty") return false;
        }
    } else {
        return false;
    }
    return true;
}

var moveLikeAKnight = function(from,to) {
    if (Math.abs(from[0] - to[0]) == 1) {
        if (Math.abs(from[1] - to[1]) != 2) return false;
    } else if (Math.abs(from[0] - to[0]) == 2) {
        if (Math.abs(from[1] - to[1]) != 1) return false;
    } else {
        return false;
    }
    return true;
}

var moveLikeABishop = function(from,to) {
    if (Math.abs(from[0] - to[0]) == Math.abs(from[1] - to[1])) {
        var direction = [to[0] > from[0] ? 1 : -1, to[1] > from[1] ? 1 : -1];
        console.log(direction);
        for (row = from[0] + direction[0], col = from[1] + direction[1]; row != to[0]; row += direction[0], col += direction[1]) {
            if (board[row][col].color != "empty") {
                console.log(board[row][col])                
                return false;
            }
        }
    } else {
        console.log("diagonally")
        return false;
    }
    return true;
}

var move = function(from, to) {
    var piece = board[from[0]][from[1]];
    var dest = board[to[0]][to[1]];

    console.log("moving %j to %j", piece, dest);
    if (piece.color != turn) return false;
    if (piece.color == dest.color) return false;
    switch (piece.role) {
        case "pawn":
            var direction = piece.color == "white" ? -1 : 1;
            if (from[1] == to[1]) { // move without capture
                if (dest.color != "empty") return false;
                if (piece.startingSquare[0] == from[0] && piece.startingSquare[1] == from[1]) { // first move?
                    if (from[0] + direction != to[0] && from[0] + 2*direction != to[0]) return false;
                } else { // no first move
                    if (from[0] + direction != to[0]) return false;
                }
            } else if (from[1] - 1 == to[1] || from[1] + 1 == to[1]) { // capture
                // todo: en pessant
                if (dest.color == "empty") return false;
                if (from[0] + direction != to[0]) return false;
            } else {
                return false;   
            }
            if (to[0] == 0 || to[0] == 7) // promotion
                piece.role = "queen";
        break;
        case "rook":
            if (!moveLikeARook(from,to)) return false;
        break;
        case "knight":
            if (!moveLikeAKnight(from,to)) return false;
        break;
        case "bishop":
            if (!moveLikeABishop(from,to)) return false;
        break;
        case "queen":
            if (!(moveLikeARook(from,to) || moveLikeABishop(from,to))) return false;
        break;
        case "king":
            if (Math.abs(from[0]-to[0]) > 1) return false;
            if (Math.abs(from[1]-to[1]) > 1) return false;
            // todo: castling
        break;
    }


    board[to[0]][to[1]] = board[from[0]][from[1]];
    board[from[0]][from[1]] = new Piece("empty", null, [-1, -1]);
    turn = (turn == "white") ? "black" : "white";
    if (dest.role == "king") turn = "won";
    return true;
}

reset();


io.sockets.on('connection', function (socket) {
  socket.emit('game', {"board":board, "turn":turn});
  socket.on('move', function (data) {
    from = data["from"];
    to = data["to"];
    if (move(from,to)) {
        data.turn = turn;
        socket.emit('move', data);
        socket.broadcast.emit('move', data);
    } else {
        socket.emit('invalid', data);
    }
  });
  socket.on("reset", function(data) {
    reset();
    socket.emit("game", {"board":board, "turn":turn});
  })
});