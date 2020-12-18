var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;

const FIELD_SIZE = 12;

app.use(express.static('public'));

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.get('/server', function(req, res){
  res.sendFile(__dirname + '/index.server.html');
});


const field = []
const players = {};

const restartField = () => {
  for (let i = 0; i < FIELD_SIZE * 20; i++) {
    field[i] = []
  for (let j = 0; j < FIELD_SIZE; j++) {
    field[i][j] = (i % 2 && i> FIELD_SIZE) ? Math.round(Math.random()) : 0;
  }}
  Object.keys(players).forEach(key => {
    const player = players[key];
    player.position = [Math.round(Math.random() * FIELD_SIZE/2), Math.round(Math.random() * FIELD_SIZE)]
    field[player.position[0]][player.position[1]] = key
  });
}
restartField()

const sendData = throttle(() => {
  io.emit('field', field);
}, 300)

io.on('connection', function(socket){
  io.emit('players', players);
  sendData()

  socket.on('new', function(data){
    data.position = [0, Object.keys(players).length]
    players[socket.id] = data;
    field[data.position[0]][data.position[1]] = socket.id
    io.emit('players', players);
  });

  socket.on('start', () => {
    restartField();
    sendData();
  });

  socket.on('disconnect', () => {
    if (players[socket.id]) {
      const position = players[socket.id].position;
      field[position[0]][position[1]] = 0;
      delete players[socket.id];
      io.emit('players', players);
    }
  })

  socket.on('action', (direction) => {
    if (!players[socket.id]) {
      return null
    }
    const positionOld = players[socket.id].position.slice();
    const positionNew = positionOld.slice();
    
    switch (direction) {
      case 'left':
        positionNew[1]--;
        break;
      case 'right':
        positionNew[1]++;
        break;
      case 'up':
        positionNew[0]++;
        break;
      case 'down':
        positionNew[0]--;
        break;
    }
    if (positionNew[0] >= field.length) {
      io.emit('win', socket.id);
      return null;
    }
    if (positionNew[0] < 0 || positionNew[1] < 0 || positionNew[1] >= FIELD_SIZE || field[positionNew[0]][positionNew[1]] !== 0 ) {
      return null;
    }
    players[socket.id].position = positionNew;
    field[positionOld[0]][positionOld[1]] = 0;
    field[positionNew[0]][positionNew[1]] = socket.id;
    sendData();
  });
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});


function throttle(func, ms) {

  let isThrottled = false,
    savedArgs,
    savedThis;

  function wrapper() {

    if (isThrottled) { // (2)
      savedArgs = arguments;
      savedThis = this;
      return;
    }

    func.apply(this, arguments); // (1)

    isThrottled = true;

    setTimeout(function() {
      isThrottled = false; // (3)
      if (savedArgs) {
        wrapper.apply(savedThis, savedArgs);
        savedArgs = savedThis = null;
      }
    }, ms);
  }

  return wrapper;
}