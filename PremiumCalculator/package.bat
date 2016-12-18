@echo off
cd %1
rmdir /S /Q %3Chrome
%27za.exe a -tzip %3Chrome\%4.zip ^
	Icons\icon16.png^
	Icons\icon32.png^
	Icons\icon48.png^
	Icons\icon128.png^
	Scripts\background.min.js^
	Scripts\extension.min.js^
	Scripts\options.min.js^
	manifest.json^
	options.min.html^
	LICENSE.md^
	..\..\key.pem

rmdir /S /Q %3Firefox
%27za.exe a -tzip %3Firefox\%4.zip ^
	Icons\icon16.png^
	Icons\icon32.png^
	Icons\icon48.png^
	Icons\icon128.png^
	Scripts\background.min.js^
	Scripts\extension.min.js^
	Scripts\options.min.js^
	manifest.json^
	options.min.html^
	LICENSE.md
