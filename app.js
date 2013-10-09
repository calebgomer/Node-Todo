var express = require('express');
var app = express();
var MemoryStore = express.session.MemoryStore;
var sessionStore = new MemoryStore();
var passportSocketIo = require('passport.socketio');
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var passport = require('passport');
// var util = require('util');
var GoogleStrategy = require('passport-google').Strategy;
var mongo = require('mongodb');

var mongoUri = process.env.MONGOHQ_URL;
var Users;
var Lists;

// Auth URLs
var LOGGED_IN_HOME_PATH = '/';
var LOGGED_OUT_HOME_PATH = '/';
var BASE_DEBUG_URL = 'http://localhost:3000';
var LOGIN_PATH = '/login';
var LOGIN_PATH_GOOGLE = '/login/google';
var LOGIN_CALLBACK_PATH = '/login/google/return';
var LOGOUT_PATH = '/logout';
 
io.set('authorization', passportSocketIo.authorize({
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  cookieParser: express.cookieParser,
  fail: function(data, accept) {
    accept(null, false);
  },
  success: function(data, accept) {
    accept(null, true);
  }
}));

if (process.env.HEROKU) {
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10);
}
io.set('log level', 1);
io.sockets.on('connection', function(socket) {
  var user = socket.handshake && socket.handshake.user && socket.handshake.user.userid;

  socket.on('newList', function(data) {
    var list = data && data.list;
    if (list) {
      _addList(user, list, function(err, result) {
        if (err) {
          socket.emit('newList', {success: false, message: err});
        } else {
          socket.emit('newList', {success: true, message: result, list: list});
        }
      });
    } else {
      socket.emit('newList', {success: false, message: 'new list needs a name!'});
    }
  });

  socket.on('newTask', function(data) {
    var list = data && data.list;
    var name = data && data.name;
    var note = data && data.note;
    var tags = data && data.tags;

    if (list && name) {
      var task = new Task(name, note, tags);
      _addTask(user, list, task, function(err, result) {
        if (err) {
          socket.emit('newTask', {success: false, message: err});
        } else {
          socket.emit('newTask', {success: true, message: result, newTask: task});
        }
      });
    } else {
      socket.emit('newTask', {success: false, message: 'incorrect arguments'});
    }
  });

  socket.on('removeTask', function(data) {
    var list = data && data.list;
    var taskPosition = data && data.taskPosition;
    if (list && taskPosition >= 0) {
      _deleteTask(user, list, taskPosition, function(err, result) {
        if (err) {
          socket.emit('removeTask', {success: false, message: err});
        } else {
          socket.emit('removeTask', {success: true, message: result});
        }
      });
    } else {
      socket.emit('removeTask', {success: false, message: 'what task and list?!'});
    }
  });

  socket.on('getTasks', function(data) {
    var list = data && data.list;
    if (list) {
      _getTasks(user, list, function(err, tasks) {
        if (err) {
          socket.emit('tasks', {success: false, message: err});
        } else {
          socket.emit('tasks', {success: true, list: list, tasks: tasks});
        }
      });
    } else {
      socket.emit('tasks', {success: false, message: 'what list do you want?!'});
    }
  });
});


function findUserCollection(callback) {
  if (Users) {
    if (callback) { callback(); }
  } else {
    mongo.Db.connect(mongoUri, function (err, theDb) {
      if (err) {
        if (callback) { callback(err); }
      } else {
        theDb.collection('users', function(er, theUserCollection) {
          if (er) {
            if (callback) { callback(er); }
          } else {
            Users = theUserCollection;
            if (callback) { callback(); }
          }
        });
      }
    });
  }
}

findUserCollection();

function findListCollection(callback) {
  if (Lists) {
    if (callback) { callback(); }
  } else {
    mongo.Db.connect(mongoUri, function(err, theDb) {
      if (err) {
        if (callback) { callback(err); }
      } else {
        theDb.collection('lists', function(er, theListCollection) {
          if (er) {
            if (callback) { callback(er); }
          } else {
            Lists = theListCollection;
            if (callback) { callback(); }
          }
        });
      }
    });
  }
}

findListCollection();

function _addList(user, name, callback) {
  findListCollection(function(err) {
    if (err) {
      console.log('error getting lists collection',err);
    } else {
      _getList(user, name, function(errr, result) {
        if (errr) {
          console.log('error getting this list');
        } else {
          if (result) {
            callback(name+' list already exists');
          } else {
            Lists.insert({name: name, user: user, tasks: []}, {safe:true}, callback);
          }
        }
      });
    }
  })
}

function _getLists(user, callback) {
  findListCollection(function(err) {
    if (err) {
      console.log('error getting lists collection',err);
    } else {
      Lists.find({user: user}, {name: 1}).toArray(function(err, lists) {
        callback(err,lists);
      });
    }
  });
}

function _getList(user, name, callback) {
  findListCollection(function(err) {
    if (err) {
      console.log('error getting lists collection',err);
    } else {
      Lists.findOne({name: name, user: user}, callback);
    }
  });
}

function _removeList(user, name, callback) {
  findListCollection(function(err) {
    if (err) {
      console.log('error getting lists collection',err);
    } else {
      Lists.remove({name: name, user: user}, callback);
    }
  });
}

function _renameList(user, oldname, name, callback) {
  findListCollection(function(err) {
    if (err) {
      console.log('error getting lists collection',err);
    } else {
      Lists.update({name: oldname, user: user}, {$set: {name: name}}, {upsert: true}, callback);
    }
  });
}

function _addTask(user, list, task, callback) {
  _getTasks(user, list, function(err, tasks) {
    tasks.push(task);
    _updateListTasks(user, list, tasks, function(err, result) {
      if (err) {
        callback('problem saving new task');
      } else {
        callback(null, result);
      }
    });
  });
}

function _deleteTask(user, list, taskPosition, callback) {
  _getTasks(user, list, function(err, tasks) {
    if (taskPosition >= 0 && tasks.length > taskPosition) {
      tasks.splice(taskPosition, 1);
      _updateListTasks(user, list, tasks, function(err, result) {
        if (err) {
          callback('problem deleting task');
        } else {
          callback(null, result);
        }
      });
    } else {
      callback('the list is not that long');
    }
  });
}

function _getTasks(user, name, callback) {
  if (name) {
    _getList(user, name, function(err, result) {
      if (err) {
        callback('problem getting list');
      } else if (result) {
        callback(null, result.tasks);
      } else {
        callback('this list doesn\'t exist');
      }
    });
  } else {
    callback('no task name!');
  }
}

function _updateListTasks(user, name, tasks, callback) {
  findListCollection(function(err) {
    if (err) {
      console.log('error getting lists collection',err);
    } else {
      Lists.update({name: name, user: user}, {$set: {tasks: tasks}}, {upsert: true}, callback);
    }
  });
}

function _moveTask(user, list, from, to, callback) {
  if (list) {
    _getTasks(user, list, function(err, tasks) {
      if (err) {
        callback('error getting tasks', err);
      } else if (tasks.length >= to && tasks.length >= from) {
        tasks.splice(to, 0, tasks.splice(from, 1)[0]);
        _updateListTasks(user, list, tasks, function(errr, result) {
          if (errr) {
            callback('problem moving task',errr);
          } else {
            callback();
          }
        });
      } else {
        callback('you can\'t move a task between those positions');
      }
    });
  } else {
    callback('no list name!');
  }
}

// task format
function Task(name, note, tags) {
  this.name = name || 'untitled';
  this.note = note || '';
  if (tags) {
    if (Array.isArray(tags)) {
      this.tags = tags;
    } else {
      this.tags = tags.split(',');
    }
  } else {
    this.tags = [];
  }
}

function getCallbackUrl() {
  return getRealm() + LOGIN_CALLBACK_PATH;
}

function getRealm() {
  return process.env.APP_URL || BASE_DEBUG_URL;
}

function serializeUser(user, callback) {
  findUserCollection(function(err) {
    if (err) {
      console.log('error serializing user',err);
      callback(err);
    } else {
      Users.update(
        {userid: user.identifier},
        {$set: {userid: user.identifier, name: user.displayName, email: user.emails.length?user.emails[0].value:undefined}},
        {upsert: true},
        function(er, result) {
          if (er) {
            console.log(er);
          }
          callback(er, user.identifier);
        }
      );
    }
  });
}

function deserializeUser(userid, callback) {
  findUserCollection(function(err) {
    if (err) {
      callback(err);
    } else {
      Users.findOne(
        {userid: userid},
        function(er, user) {
          callback(er,user);
        }
      );
    }
  });
}

passport.serializeUser(serializeUser);
passport.deserializeUser(deserializeUser);

passport.use(new GoogleStrategy({
    returnURL: getCallbackUrl(),
    realm: getRealm()
  },
  function(identifier, profile, done) {
    process.nextTick(function () {
      profile.identifier = identifier;
      return done(null, profile);
    });
  }
));

app.configure(function() {
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET }));
  app.use(express.methodOverride());
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
  app.use('/public', express.static(__dirname + '/public'));
});

app.get('/', ensureLists, home);
app.get('/login', ensureLists, login);
app.get('/account', ensureAuthenticated, ensureLists, account);
app.get('/l', ensureAuthenticated, ensureLists, getLists);
app.get('/l/:name', ensureAuthenticated, ensureLists, getList);
app.get('/rm/:name', ensureAuthenticated, ensureLists, removeList);
app.get('/rn/:oldname/:name', ensureAuthenticated, ensureLists, renameList);
app.get('/n/:name', ensureAuthenticated, ensureLists, addList);
app.get('/t/:list/:name/:note/:tags', ensureAuthenticated, ensureLists, newTask);
app.get('/mv/:list/:from/:to', ensureAuthenticated, ensureLists, moveTask);

function home(req, res) {
  console.log(req.user);
  res.render('home', { user: req.user, lists:[{id:1234, name:'beers'}, {id:5678, name:'homework'}] });
};

function account(req, res) {
  res.render('account', { user: req.user, lists:[{id:1234, name:'beers'}, {id:5678, name:'homework'}] });
}

function login(req, res) {
  res.render('login', { user: req.user, lists:[{id:1234, name:'beers'}, {id:5678, name:'homework'}] });
}

function getLists(req, res) {
  if (req.user.lists) {
    return res.send(req.user.lists);
  }
  var user = req.user.userid;
  _getLists(user, function(err, result) {
    console.log('err',err,'result',result);
    res.send({err: err, result: result});
  });
}

function getList(req, res) {
  var user = req.user.userid;
  var name = req.params.name;
  if (name) {
    _getList(user, name, function(err, result) {
      if (err) {
        res.send({error: err});
      } else if (result && result.tasks) {
        res.render('list', { user: req.user, tasks: result.tasks });
      } else {
        res.redirect('/');
      }
    });
  } else {
    res.render('home', { user: req.user, lists:[{id:1234, name:'beers'}, {id:5678, name:'homework'}] });
  }
}

function addList(req, res) {
  var user = req.user.userid;
  var name = req.params.name;
  if (name) {
    _addList(user, name, function(err, result) {
      res.send({err: err, result: result});
    });
  } else {
    res.send('no list name!');
  }
}

function renameList(req, res) {
  var user = req.user.userid;
  var oldname = req.params.oldname;
  var name = req.params.name;

  _renameList(user, oldname, name, function(err, result) {
    res.send({err: err, result: result});
  });
}

function removeList(req, res) {
  var user = req.user.userid;
  var name = req.params.name;
  if (name) {
    _removeList(user, name, function(err, result) {
      res.send({err: err, result: result});
    });
  } else {
    res.send('no list name!');
  }
}

function newTask(req, res) {
  var user = req.user.userid;
  var list = req.params.list;
  var name = req.params.name;
  var note = req.params.note;
  var tags = req.params.tags;

  if (list && name) {
    var task = new Task(name, note, tags);
    _addTask(user, list, task, function(err, result) {
      if (err) {
        console.log('problem saving new task',err);
        res.send('problem saving new task');
      } else {
        res.send({result: result});
      }
    });
  }
}

function moveTask(req, res) {
  var user = req.user.userid;
  var list = req.params.list;
  var from = req.params.from;
  var to = req.params.to;

  _moveTask(user, list, from, to, function(err, result) {
    res.send({err: err, result: result});
  });
}

app.get(LOGIN_PATH_GOOGLE,
  passport.authenticate('google', { failureRedirect: LOGIN_PATH }),
  function(req, res) {
    res.redirect(LOGGED_IN_HOME_PATH);
  }
);

app.get(LOGIN_CALLBACK_PATH,
  passport.authenticate('google', { failureRedirect: LOGIN_PATH }),
  function(req, res) {
    res.redirect(LOGGED_IN_HOME_PATH);
  }
);

app.get(LOGOUT_PATH, function(req, res){
  req.logout();
  res.redirect(LOGGED_OUT_HOME_PATH);
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect(LOGIN_PATH);
}

function ensureLists(req, res, next) {
  if (req.isAuthenticated() && req.user && req.user.userid) {
    _getLists(req.user.userid, function(err, lists) {
      req.user.lists = lists;
      next();
    });
  } else {
    next();
  }
}

server.listen(app.get('port'), function() {
  console.log("ready on port " + app.get('port'));
});
