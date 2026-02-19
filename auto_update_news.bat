@echo off
cd /d "c:\Users\gongs\Desktop\newhomepage"
echo ================================================== >> update_log.txt
echo [%DATE% %TIME%] Auto Update Started >> update_log.txt
node ingest.js >> update_log.txt 2>&1
echo [%DATE% %TIME%] Auto Update Completed >> update_log.txt
echo ================================================== >> update_log.txt
