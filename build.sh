#!/usr/bin/env bash
git pull
rm -rf ../painel/*
NODE_ENV=production grunt build --force
