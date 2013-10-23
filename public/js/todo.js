// just log instead of communicating in case websockets aren't ready
var socket = {emit: console.log};

$(function() {
  setupWebSockets();
  setupButtons();
});

function setupWebSockets() {
  socket = io.connect();
  socket.on('unauthorized', function(reason) {
    console.log('unauthorized access because', reason);
  });
}

function setupButtons() {
  $('.task').click(function(e) {
    console.log(this.id.toString());
    e.stopPropagation();
    var taskIdParts = this.id && this.id.toString().split(':');
    var taskPosition = taskIdParts && taskIdParts.length > 1 && taskIdParts[1];
    if (taskPosition) {
      toggleComplete(CURRENT_LIST, taskPosition);
    }
  });
  $('.delete-task').click(function(e) {
    e.stopPropagation();
    console.log(this.id);
  });
  $('.edit-task').click(function(e) {
    e.stopPropagation();
    console.log(this.id);
  });
  $('#logIn').click(function() {
    location.href='/login/google';
  });
  $('#logOut').click(function() {
    if (confirm('Log Out?')) {
      location.href='/logout';
    }
  });
  $('#newList').click(function() {
    newList(prompt('list name'));
  });

  $('#newTask').keypress(function(e) {
    if (e.which == 13) {
      var bigString = $('#newTask').val();
      var newTaskStrings = bigString.split(';;');
      for (var i in newTaskStrings) {
        var newTaskString = newTaskStrings[i];
        var newTaskParts = newTaskString.split('::');
        var name = newTaskParts.length > 0 && newTaskParts[0];
        var note = newTaskParts.length > 1 && newTaskParts[1];
        var tags = newTaskParts.length > 2 && newTaskParts[2] && newTaskParts[2].split(',');
        newTask(CURRENT_LIST, name, note, tags);
      }
    }
  });
}

function newTask(list, name, note, tags) {
  socket.emit('newTask', {list: list, name: name, note: note, tags: tags}, function(data) {
    if (data && data.success) {
      console.log('success!',data.newTask);

    } else if (data && !data.success) {
      console.log('fail!');
    }
  });
}

function toggleComplete(list, taskPosition) {
  socket.emit('toggleComplete', {list: list, taskPosition: taskPosition}, function(data) {
    console.log(data);
  });
}

function moveTask(list, from, to) {

}

function replaceTask(list, taskPosition, newTask) {

}

function removeTask(list, taskPosition) {
  socket.emit('removeTask', {list: list, taskPosition: taskPosition}, function(data) {
    if (data && data.success) {
      console.log('success!',data);
    } else {
      console.log('fail!',data);
    }
  });
}

function getTasks(list) {
  socket.emit('getTasks', {list: list}, function(data) {
    if (data && data.success && data.list && data.tasks) {
      console.log(data.list, data.tasks);
    } else if (data) {
      console.log(data.success, data.message);
    }
  });
}

function newList(name) {
  socket.emit('newList', {list: name}, function(data) {
  if (data && data.success && data.list) {
      location.href='/l/'+data.list;
    } else if (data) {
      console.log(data.success,data.message);
    }
  });
}

function renameList(name, newName) {

}

function removeList(name) {

}
