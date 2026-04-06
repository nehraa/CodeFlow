package main

import "fmt"

// ProcessData handles incoming data and returns the result
func ProcessData(input string) string {
	result := formatString(input)
	return result
}

func formatString(s string) string {
	return fmt.Sprintf("processed: %s", s)
}

type UserService struct {
	db *Database
}

func (s *UserService) GetUser(id int) string {
	data := ProcessData("user")
	return data
}

func (s *UserService) SaveUser(name string) bool {
	formatted := formatString(name)
	return len(formatted) > 0
}

type Database struct {
	host string
}

func (d *Database) Connect() bool {
	return true
}

func main() {
	svc := UserService{}
	user := svc.GetUser(1)
	fmt.Println(user)
}
