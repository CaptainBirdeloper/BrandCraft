@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "VITE_BIN=node_modules\vite\bin\vite.js"
if not exist "%VITE_BIN%" goto nodeps

rem Prefer node from PATH, then the bundled runtime, then NODE_EXE if the user set one.
set "NODE="
if defined NODE_EXE if exist "%NODE_EXE%" set "NODE=%NODE_EXE%"
if not defined NODE for %%N in (node.exe) do if not defined NODE if exist "%%~$PATH:N" set "NODE=%%~$PATH:N"
if not defined NODE if exist "%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" set "NODE=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE goto nonode

echo.
echo   BrandCraft - starting dev server
echo   http://localhost:5173  (Ctrl+C to stop)
echo.
rem No arguments: dev server on 5173 and open the browser. Any arguments are
rem passed straight to vite, e.g.  start.cmd --port 5199   or   start.cmd preview
if "%~1"=="" (
  "%NODE%" "%VITE_BIN%" --port 5173 --open
) else (
  "%NODE%" "%VITE_BIN%" %*
)
goto done

:nodeps
echo.
echo   node_modules is missing.
echo   Install dependencies first, then run this again:
echo.
echo       pnpm install
echo.
pause
exit /b 1

:nonode
echo.
echo   Node.js was not found.
echo   Install Node 20 or newer, or set NODE_EXE to the full path of node.exe:
echo.
echo       set NODE_EXE=C:\Program Files\nodejs\node.exe
echo.
pause
exit /b 1

:done
echo.
echo   Server stopped.
pause
