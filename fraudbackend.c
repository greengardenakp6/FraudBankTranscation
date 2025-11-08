#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <math.h>

#define MAX_ACCOUNTS 10
#define MAX_TRANSACTIONS 100
#define MAX_ALERTS 10
#define BUFFER_SIZE 1024

typedef struct {
    int accNo;
    char name[50];
    double balance;
    char lastLocation[30];
    time_t lastTxnTime;
    int transactionCount;
    char phone[20];
    char email[100];
} Account;

typedef struct {
    int txnId;
    int accNo;
    double amount;
    char location[30];
    time_t timestamp;
    char alerts[MAX_ALERTS][100];
    int alertCount;
    int riskScore;
    char status[20];
    char phone[20];
    char email[100];
} Transaction;

Account accounts[MAX_ACCOUNTS];
Transaction transactions[MAX_TRANSACTIONS];
int txnCount = 0;

void setupAccounts() {
    Account sampleAccounts[] = {
        {100, "Alice Smith", 150000.0, "", 0, 0, "+1234567890", "alice@example.com"},
        {101, "Bob Johnson", 75000.0, "", 0, 0, "+1234567891", "bob@example.com"},
        {102, "Carol Davis", 250000.0, "", 0, 0, "+1234567892", "carol@example.com"},
        {103, "David Wilson", 50000.0, "", 0, 0, "+1234567893", "david@example.com"},
        {104, "Eva Brown", 300000.0, "", 0, 0, "+1234567894", "eva@example.com"},
        {105, "Frank Miller", 120000.0, "", 0, 0, "+1234567895", "frank@example.com"},
        {106, "Grace Lee", 80000.0, "", 0, 0, "+1234567896", "grace@example.com"},
        {107, "Henry Clark", 200000.0, "", 0, 0, "+1234567897", "henry@example.com"},
        {108, "Ivy Garcia", 60000.0, "", 0, 0, "+1234567898", "ivy@example.com"},
        {109, "Jack Martinez", 180000.0, "", 0, 0, "+1234567899", "jack@example.com"}
    };
    
    for (int i = 0; i < MAX_ACCOUNTS; i++) {
        accounts[i] = sampleAccounts[i];
    }
}

void addAlert(Transaction *txn, const char *alert) {
    if (txn->alertCount < MAX_ALERTS) {
        strcpy(txn->alerts[txn->alertCount], alert);
        txn->alertCount++;
    }
}

int calculateRiskScore(Transaction *txn) {
    int score = 0;
    
    for (int i = 0; i < txn->alertCount; i++) {
        if (strstr(txn->alerts[i], "Very high-value")) score += 50;
        else if (strstr(txn->alerts[i], "High-value")) score += 25;
        else if (strstr(txn->alerts[i], "Multiple rapid")) score += 30;
        else if (strstr(txn->alerts[i], "Impossible travel")) score += 40;
        else if (strstr(txn->alerts[i], "Location change")) score += 10;
        else if (strstr(txn->alerts[i], "Round amount")) score += 5;
        else if (strstr(txn->alerts[i], "Unusual location")) score += 15;
    }
    
    return (score > 100) ? 100 : score;
}

void checkFraud(Transaction *txn) {
    Account *acc = NULL;
    for (int i = 0; i < MAX_ACCOUNTS; i++) {
        if (accounts[i].accNo == txn->accNo) { 
            acc = &accounts[i]; 
            break; 
        }
    }
    if (!acc) return;

    // High value transaction checks
    if (txn->amount > 100000) {
        addAlert(txn, "Very high-value transaction");
    } else if (txn->amount > 50000) {
        addAlert(txn, "High-value transaction");
    }

    // Rapid transaction check (last 5 minutes)
    int recentCount = 0;
    time_t fiveMinutesAgo = txn->timestamp - 300; // 5 minutes in seconds
    
    for (int i = 0; i < txnCount; i++) {
        if (transactions[i].accNo == txn->accNo && 
            transactions[i].timestamp >= fiveMinutesAgo) {
            recentCount++;
        }
    }
    
    if (recentCount >= 3) {
        addAlert(txn, "Multiple rapid transactions detected");
    }

    // Location-based checks
    if (strlen(acc->lastLocation) > 0) {
        double timeDiff = difftime(txn->timestamp, acc->lastTxnTime);
        
        // Impossible travel check (less than 2 hours between distant locations)
        if (timeDiff < 7200) { // 2 hours
            if ((strcmp(acc->lastLocation, "Tokyo") == 0 && strcmp(txn->location, "New York") == 0) ||
                (strcmp(acc->lastLocation, "London") == 0 && strcmp(txn->location, "Sydney") == 0) ||
                (strcmp(acc->lastLocation, "Paris") == 0 && strcmp(txn->location, "Dubai") == 0)) {
                addAlert(txn, "Impossible travel detected");
            } else if (strcmp(acc->lastLocation, txn->location) != 0) {
                addAlert(txn, "Location change detected");
            }
        }
    }

    // Unusual location check
    const char *usualLocations[] = {"New York", "London", "Tokyo", "Paris", "Sydney", "Dubai"};
    int found = 0;
    for (int i = 0; i < 6; i++) {
        if (strcmp(txn->location, usualLocations[i]) == 0) {
            found = 1;
            break;
        }
    }
    if (!found) {
        addAlert(txn, "Unusual location");
    }

    // Round amount check
    if (fmod(txn->amount, 1000.0) == 0 && txn->amount > 1000.0) {
        addAlert(txn, "Round amount transaction");
    }

    // Update account location and time
    strcpy(acc->lastLocation, txn->location);
    acc->lastTxnTime = txn->timestamp;
    acc->transactionCount++;

    // Calculate risk score
    txn->riskScore = calculateRiskScore(txn);
    
    // Determine status
    if (txn->riskScore > 20) {
        strcpy(txn->status, "suspicious");
    } else {
        strcpy(txn->status, "clean");
        if (txn->alertCount == 0) {
            addAlert(txn, "No fraud detected");
        }
    }
}

void printJsonResponse(Transaction *txn, double remainingBalance) {
    printf("{\n");
    printf("  \"success\": true,\n");
    printf("  \"transaction\": {\n");
    printf("    \"id\": %d,\n", txn->txnId);
    printf("    \"accNo\": %d,\n", txn->accNo);
    printf("    \"amount\": %.2f,\n", txn->amount);
    printf("    \"location\": \"%s\",\n", txn->location);
    printf("    \"timestamp\": %ld,\n", txn->timestamp);
    printf("    \"riskScore\": %d,\n", txn->riskScore);
    printf("    \"status\": \"%s\",\n", txn->status);
    printf("    \"remainingBalance\": %.2f,\n", remainingBalance);
    printf("    \"phone\": \"%s\",\n", txn->phone);
    printf("    \"email\": \"%s\",\n", txn->email);
    printf("    \"alerts\": [\n");
    
    for (int i = 0; i < txn->alertCount; i++) {
        printf("      \"%s\"%s\n", txn->alerts[i], 
               (i < txn->alertCount - 1) ? "," : "");
    }
    
    printf("    ]\n");
    printf("  }\n");
    printf("}\n");
}

void performTransaction(int accNo, double amount, const char *location, const char *phone, const char *email) {
    if (txnCount >= MAX_TRANSACTIONS) {
        printf("{\"success\": false, \"error\": \"Transaction limit reached\"}");
        return;
    }

    // Find account and validate
    Account *acc = NULL;
    for (int i = 0; i < MAX_ACCOUNTS; i++) {
        if (accounts[i].accNo == accNo) {
            acc = &accounts[i];
            break;
        }
    }
    
    if (!acc) {
        printf("{\"success\": false, \"error\": \"Account not found\"}");
        return;
    }
    
    if (acc->balance < amount) {
        printf("{\"success\": false, \"error\": \"Insufficient balance\"}");
        return;
    }

    // Create transaction
    Transaction txn;
    txn.txnId = txnCount + 1;
    txn.accNo = accNo;
    txn.amount = amount;
    strcpy(txn.location, location);
    strcpy(txn.phone, phone);
    strcpy(txn.email, email);
    txn.timestamp = time(NULL);
    txn.alertCount = 0;
    txn.riskScore = 0;
    
    // Update account balance
    acc->balance -= amount;
    double remainingBalance = acc->balance;
    
    // Check for fraud
    checkFraud(&txn);
    
    // Store transaction
    if (txnCount < MAX_TRANSACTIONS) {
        transactions[txnCount] = txn;
        txnCount++;
    }
    
    // Print JSON response
    printJsonResponse(&txn, remainingBalance);
}

int main(int argc, char *argv[]) {
    if (argc != 6) {
        printf("{\"success\": false, \"error\": \"Usage: ./fraudbackend <accNo> <amount> <location> <phone> <email>\"}");
        return 1;
    }

    setupAccounts();

    int accNo = atoi(argv[1]);
    double amount = atof(argv[2]);
    char *location = argv[3];
    char *phone = argv[4];
    char *email = argv[5];

    if (accNo < 100 || accNo > 109) {
        printf("{\"success\": false, \"error\": \"Invalid account number\"}");
        return 1;
    }
    
    if (amount <= 0) {
        printf("{\"success\": false, \"error\": \"Invalid amount\"}");
        return 1;
    }

    performTransaction(accNo, amount, location, phone, email);
    return 0;
}
