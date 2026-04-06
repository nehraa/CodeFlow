// processData processes input data
function processData(input) {
  return calculateSum(input);
}

function calculateSum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

class BaseService {
  constructor() {
    this.initialized = false;
  }
}

class UserService extends BaseService {
  getUser(id) {
    return processData([id]);
  }

  saveUser(user) {
    return user;
  }
}

class TaskService extends BaseService {
  createTask(task) {
    return task;
  }
}

module.exports = { UserService, TaskService, processData };
