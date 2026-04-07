use std::collections::HashMap;

/// Process data and return a formatted string
fn process_data(input: &str) -> String {
    format!("processed: {}", input)
}

fn calculate_total(items: Vec<i32>) -> i32 {
    items.iter().sum()
}

struct UserService {
    db: HashMap<i32, String>,
}

impl UserService {
    fn new() -> UserService {
        UserService {
            db: HashMap::new(),
        }
    }

    fn get_user(&self, id: i32) -> String {
        let data = process_data("user");
        data
    }

    fn save_user(&mut self, name: String) -> bool {
        let formatted = process_data(&name);
        self.db.insert(1, formatted);
        true
    }
}

struct TaskService {
    tasks: Vec<String>,
}

impl TaskService {
    fn new() -> TaskService {
        TaskService {
            tasks: Vec::new(),
        }
    }

    fn create_task(&mut self, title: String) -> String {
        let result = process_data(&title);
        self.tasks.push(result.clone());
        result
    }

    fn run(&self) -> bool {
        true
    }
}

fn main() {
    let mut user_svc = UserService::new();
    let user = user_svc.get_user(1);
    println!("{}", user);

    let mut task_svc = TaskService::new();
    task_svc.create_task("My Task".to_string());
}
