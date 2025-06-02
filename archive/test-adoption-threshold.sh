#!/bin/bash

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================================================================${NC}"
echo -e "${BLUE}                    ONVIF Adoption Threshold Test${NC}"
echo -e "${BLUE}================================================================================${NC}"
echo ""
echo -e "${YELLOW}This test will help find how many cameras can be adopted at once.${NC}"
echo -e "${YELLOW}Start with a small number and increase until adoption fails.${NC}"
echo ""

# Get starting number
echo -n "Start with how many cameras? [2]: "
read START_NUM
START_NUM=${START_NUM:-2}

# Get increment
echo -n "Increase by how many each time? [1]: "
read INCREMENT
INCREMENT=${INCREMENT:-1}

# Get max
echo -n "Maximum cameras to test? [10]: "
read MAX_NUM
MAX_NUM=${MAX_NUM:-10}

CURRENT=$START_NUM

while [ $CURRENT -le $MAX_NUM ]; do
    echo ""
    echo -e "${GREEN}Testing with $CURRENT cameras...${NC}"
    echo -e "${BLUE}================================================================================${NC}"
    
    # Run the server
    node test-few-cameras.js config.yaml $CURRENT &
    SERVER_PID=$!
    
    echo ""
    echo -e "${YELLOW}Server started with $CURRENT cameras.${NC}"
    echo -e "${YELLOW}Try to adopt ALL cameras in Unifi Protect now.${NC}"
    echo ""
    echo -n "Were you able to adopt all $CURRENT cameras successfully? (y/n/q): "
    read RESULT
    
    # Stop the server
    kill $SERVER_PID 2>/dev/null
    sleep 2
    
    case $RESULT in
        y|Y)
            echo -e "${GREEN}✓ Success with $CURRENT cameras${NC}"
            LAST_GOOD=$CURRENT
            CURRENT=$((CURRENT + INCREMENT))
            ;;
        n|N)
            echo -e "${RED}✗ Failed with $CURRENT cameras${NC}"
            echo ""
            echo -e "${BLUE}================================================================================${NC}"
            echo -e "${GREEN}RESULT: Adoption works with up to $LAST_GOOD cameras${NC}"
            echo -e "${RED}RESULT: Adoption fails with $CURRENT cameras${NC}"
            echo -e "${BLUE}================================================================================${NC}"
            exit 0
            ;;
        q|Q)
            echo -e "${YELLOW}Test cancelled${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid response. Assuming failure.${NC}"
            echo ""
            echo -e "${BLUE}================================================================================${NC}"
            echo -e "${GREEN}RESULT: Adoption works with up to $LAST_GOOD cameras${NC}"
            echo -e "${RED}RESULT: Adoption fails with $CURRENT cameras${NC}"
            echo -e "${BLUE}================================================================================${NC}"
            exit 0
            ;;
    esac
done

echo ""
echo -e "${BLUE}================================================================================${NC}"
echo -e "${GREEN}RESULT: Successfully tested up to $LAST_GOOD cameras${NC}"
echo -e "${BLUE}================================================================================${NC}"