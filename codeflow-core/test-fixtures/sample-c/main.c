#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* Process the input data and return a formatted string */
char* process_data(const char* input) {
    char* result = (char*)malloc(256);
    sprintf(result, "processed: %s", input);
    return result;
}

int calculate_sum(int a, int b) {
    return a + b;
}

void print_result(const char* message) {
    printf("%s\n", message);
}

int main() {
    char* data = process_data("hello");
    print_result(data);
    int sum = calculate_sum(3, 4);
    free(data);
    return 0;
}
