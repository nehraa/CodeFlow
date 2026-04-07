#include <iostream>
#include <string>
#include <vector>

using namespace std;

// Base service with common functionality
class BaseService {
public:
    virtual bool connect() {
        return true;
    }

    virtual ~BaseService() = default;
};

/* Process data and return formatted result */
string process_data(const string& input) {
    return "processed: " + input;
}

// UserService handles user operations
class UserService : public BaseService {
private:
    string dbHost;

public:
    UserService(string host) : dbHost(host) {}

    string getUser(int id) {
        string data = process_data("user");
        return data;
    }

    bool saveUser(const string& name) {
        string formatted = process_data(name);
        return formatted.length() > 0;
    }
};

class TaskService : public BaseService {
public:
    string createTask(const string& title) {
        string result = process_data(title);
        return result;
    }

    bool run() {
        this->connect();
        return true;
    }
};

int main() {
    UserService userService("localhost");
    string user = userService.getUser(1);
    cout << user << endl;

    TaskService taskService;
    taskService.run();

    return 0;
}
