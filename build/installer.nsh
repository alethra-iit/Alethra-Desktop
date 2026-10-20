; Daftarkan Alethra sebagai pilihan "Browser default" Windows (per-pengguna)
!macro customInstall
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Alethra" "" "Alethra"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Alethra\DefaultIcon" "" "$INSTDIR\Alethra.exe,0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Alethra\shell\open\command" "" '"$INSTDIR\Alethra.exe"'
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Alethra\Capabilities" "ApplicationName" "Alethra"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Alethra\Capabilities" "ApplicationDescription" "Alethra Browser"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Alethra\Capabilities\URLAssociations" "http" "AlethraURL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\Alethra\Capabilities\URLAssociations" "https" "AlethraURL"
  WriteRegStr HKCU "Software\RegisteredApplications" "Alethra" "Software\Clients\StartMenuInternet\Alethra\Capabilities"
  WriteRegStr HKCU "Software\Classes\AlethraURL" "" "Alethra URL"
  WriteRegStr HKCU "Software\Classes\AlethraURL" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\AlethraURL\DefaultIcon" "" "$INSTDIR\Alethra.exe,0"
  WriteRegStr HKCU "Software\Classes\AlethraURL\shell\open\command" "" '"$INSTDIR\Alethra.exe" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Clients\StartMenuInternet\Alethra"
  DeleteRegValue HKCU "Software\RegisteredApplications" "Alethra"
  DeleteRegKey HKCU "Software\Classes\AlethraURL"
!macroend
