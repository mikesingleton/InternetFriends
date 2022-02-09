browserify ./app/scripts.babel/background.js -o ./app/scripts.babel/bundle.js
cd ./app/scripts.babel
javascript-obfuscator ./ --output ../../dist/scripts.babel
Remove-Item ../../dist/scripts.babel/background.js
cd ../../