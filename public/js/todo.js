var socket = io.connect();
socket.on('newTask', function(data) {
  if (data && data.success) {
    console.log('success!',data.newTask);
  } else if (data && !data.success) {
    console.log('fail!');
  }
});

socket.on('removeTask', function(data) {
  if (data && data.success) {
    console.log('success!',data);
  } else {
    console.log('fail!',data);
  }
});

socket.on('tasks', function(data) {
  if (data && data.success && data.list && data.tasks) {
    console.log(data.list, data.tasks);
  } else if (data) {
    console.log(data.success, data.message);
  }
});

socket.on('newList', function(data) {
  if (data && data.success && data.list) {
    location.href='/l/'+data.list;
  } else if (data) {
    console.log(data.success,data.message);
  }
});
