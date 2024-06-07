
# Viagogo-Scrape Project

## Table of Contents
- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Installation](#installation)
  - [Unzipping the Project](#unzipping-the-project)
  - [Installing Dependencies](#installing-dependencies)
  - [Running the Application](#running-the-application)

## Introduction
This is a Node.js project that get all events by location. In this README, you'll find instructions on how to set up and run the project on your local machine.

## Prerequisites
Before you can get started, make sure you have the following software installed on your system:
- [Node.js](https://nodejs.org/) (Version 18.12.1 or higher)

## Getting Started
Follow the steps below to set up and run the project.

### Installation
If you don't have Node.js, you can download and install them from the official website:
- [Node.js Download](https://nodejs.org/download/)

### Unzipping the Project
1. Download the project's ZIP file from the [repository](https://github.com/scraplay/viagogo).
2. Extract the contents of the ZIP file to a directory of your choice.

### Installing Dependencies
1. Open your terminal and navigate to the project's root directory.
   ```bash
   cd path/to/your-project
2. Use npm to install the project's dependencies as listed in the package json file:
   ```bash
   npm install
3. Install supported browsers for Playwright
   ```bash
   npx playwright install

### Running the Application
1. Set location and summary variables in the index.js file:
2. Run the application using the following command:
   ```bash
   node index.js
3. The result will be stored in a json file inside the output directory

