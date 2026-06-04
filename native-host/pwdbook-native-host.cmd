@echo off
REM 由 index.mjs 自动探测 %APPDATA%\pwd-book 与 PwdBook；勿写死错误目录
node "%~dp0index.mjs"
