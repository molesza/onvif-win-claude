#!/bin/bash

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

clear

echo -e "${BOLD}${BLUE}================================================================================${NC}"
echo -e "${BOLD}${BLUE}                         ONVIF Server Startup Options${NC}"
echo -e "${BOLD}${BLUE}================================================================================${NC}"
echo ""
echo -e "${BOLD}Choose how to start the ONVIF servers:${NC}"
echo ""
echo -e "${GREEN}1)${NC} ${BOLD}Interactive Adoption${NC} - Add cameras one by one (recommended for first setup)"
echo -e "   ${CYAN}Perfect for initial Unifi Protect adoption${NC}"
echo ""
echo -e "${GREEN}2)${NC} ${BOLD}Manual Addition${NC} - All cameras, no discovery (fastest)"
echo -e "   ${CYAN}Shows IP:Port for each camera for manual addition${NC}"
echo ""
echo -e "${GREEN}3)${NC} ${BOLD}Full Discovery${NC} - All 32 cameras with discovery"
echo -e "   ${YELLOW}⚠ May not work with all NVR systems due to large response size${NC}"
echo ""
echo -e "${GREEN}4)${NC} ${BOLD}Individual Discovery${NC} - Each camera runs its own discovery service"
echo -e "   ${CYAN}No port conflicts - each discovery runs on its own IP${NC}"
echo ""
echo -e "${GREEN}5)${NC} ${BOLD}Single Camera Test${NC} - Run with simple config (1 camera)"
echo ""
echo -e "${GREEN}6)${NC} ${BOLD}Custom Command${NC} - Run main.js with custom arguments"
echo ""
echo -e "${GREEN}0)${NC} Exit"
echo ""
echo -n "Enter your choice [1-6]: "
read choice

CONFIG_FILE="config.yaml"
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}Error: $CONFIG_FILE not found!${NC}"
    exit 1
fi

case $choice in
    1)
        echo -e "\n${GREEN}Starting Interactive Adoption Tool...${NC}\n"
        node interactive-adoption.js $CONFIG_FILE
        ;;
    2)
        echo -e "\n${GREEN}Starting Manual Addition Mode (No Discovery)...${NC}\n"
        node start-without-discovery.js $CONFIG_FILE
        ;;
    3)
        echo -e "\n${GREEN}Starting Full Discovery Mode (All 32 Cameras)...${NC}\n"
        node start-all-with-discovery.js $CONFIG_FILE
        ;;
    4)
        echo -e "\n${GREEN}Starting Individual Discovery Mode...${NC}\n"
        node start-individual-discovery.js $CONFIG_FILE
        ;;
    5)
        if [ -f "config-simple.yaml" ]; then
            echo -e "\n${GREEN}Starting Single Camera Test...${NC}\n"
            node main.js config-simple.yaml
        else
            echo -e "${RED}Error: config-simple.yaml not found!${NC}"
            exit 1
        fi
        ;;
    6)
        echo -n "Enter custom arguments for main.js: "
        read custom_args
        echo -e "\n${GREEN}Running: node main.js $custom_args${NC}\n"
        node main.js $custom_args
        ;;
    0)
        echo -e "${GREEN}Exiting...${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice!${NC}"
        exit 1
        ;;
esac