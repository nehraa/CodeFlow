"""
User service module that handles user operations.
"""

import os
import json


def load_config(path: str) -> dict:
    """Load configuration from a JSON file."""
    with open(path) as f:
        return json.load(f)


def process_data(input_str: str) -> str:
    """Process input string and return formatted result."""
    return f"processed: {input_str}"


class UserService:
    """Service for managing users."""

    def __init__(self, db_host: str):
        self.db_host = db_host

    def get_user(self, user_id: int) -> str:
        """Get a user by ID."""
        data = process_data("user")
        return data

    def save_user(self, name: str) -> bool:
        """Save a user to the database."""
        formatted = process_data(name)
        return len(formatted) > 0


class BaseService:
    """Base service with common functionality."""

    def connect(self) -> bool:
        """Connect to the service."""
        return True


class TaskService(BaseService):
    """Service for managing tasks."""

    def create_task(self, title: str) -> str:
        """Create a new task."""
        result = process_data(title)
        return result

    def run(self) -> bool:
        """Run the task service."""
        self.connect()
        return True
