#!/bin/bash

# MCP AI Bot Testing Script (USING --agent FLAG)
# Key fix: Use --agent flag to explicitly run as main agent

set -e

RESULTS_FILE="$HOME/.openclaw/mcp-test-results-$(date +%Y%m%d-%H%M%S).txt"

echo "=== MCP AI Bot Testing ===" | tee "$RESULTS_FILE"
echo "Start Time: $(date)" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

MODELS=(
  "anthropic/claude-haiku-4-5-20251001:Claude Haiku"
  "mistral/mistral-large-latest:Mistral Large"
  "mistral/mistral-medium:Mistral Medium"
)

TEST1="Can you connect to the Safecast MCP server and list the available tools?"
TEST2="Using the Safecast MCP server, get radiation data for Tokyo"
TEST3="Try to query radiation data for an invalid location via MCP and explain the error"

for model_pair in "${MODELS[@]}"; do
  IFS=':' read -r model_id model_name <<< "$model_pair"
  
  echo "======================================" | tee -a "$RESULTS_FILE"
  echo "Testing: $model_name ($model_id)" | tee -a "$RESULTS_FILE"
  echo "======================================" | tee -a "$RESULTS_FILE"
  
  echo "Setting model: $model_id" | tee -a "$RESULTS_FILE"
  openclaw models set "$model_id" 2>&1 | grep "Default model" | tee -a "$RESULTS_FILE"
  echo "" | tee -a "$RESULTS_FILE"
  
  echo "TEST 1: MCP Connection" | tee -a "$RESULTS_FILE"
  echo "Prompt: $TEST1" | tee -a "$RESULTS_FILE"
  echo "Response:" | tee -a "$RESULTS_FILE"
  openclaw agent --agent main -m "$TEST1" 2>&1 | tee -a "$RESULTS_FILE"
  echo "" | tee -a "$RESULTS_FILE"
  
  echo "TEST 2: MCP Query" | tee -a "$RESULTS_FILE"
  echo "Prompt: $TEST2" | tee -a "$RESULTS_FILE"
  echo "Response:" | tee -a "$RESULTS_FILE"
  openclaw agent --agent main -m "$TEST2" 2>&1 | tee -a "$RESULTS_FILE"
  echo "" | tee -a "$RESULTS_FILE"
  
  echo "TEST 3: Error Handling" | tee -a "$RESULTS_FILE"
  echo "Prompt: $TEST3" | tee -a "$RESULTS_FILE"
  echo "Response:" | tee -a "$RESULTS_FILE"
  openclaw agent --agent main -m "$TEST3" 2>&1 | tee -a "$RESULTS_FILE"
  echo "" | tee -a "$RESULTS_FILE"
  
  sleep 3
done

echo "======================================" | tee -a "$RESULTS_FILE"
echo "End Time: $(date)" | tee -a "$RESULTS_FILE"
echo "Results saved to: $RESULTS_FILE" | tee -a "$RESULTS_FILE"

echo ""
echo "✓ Testing complete!"
echo "Results: $RESULTS_FILE"
