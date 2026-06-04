; PwdBook install: register native messaging host for browser extension (Chrome / Edge).

!macro customInstall
  WriteRegStr HKCU "Software\Google\Chrome\NativeMessagingHosts\com.pwdbook.app" "" "$INSTDIR\resources\native-host\com.pwdbook.app.json"
  WriteRegStr HKCU "Software\Microsoft\Edge\NativeMessagingHosts\com.pwdbook.app" "" "$INSTDIR\resources\native-host\com.pwdbook.app.json"
!macroend

; PwdBook uninstall: optionally remove local vault data (skip during in-place updates).

!macro customUnInstall
  DeleteRegKey HKCU "Software\Google\Chrome\NativeMessagingHosts\com.pwdbook.app"
  DeleteRegKey HKCU "Software\Microsoft\Edge\NativeMessagingHosts\com.pwdbook.app"
  ; Installer passes --updated when upgrading; do not prompt or delete data then.
  ClearErrors
  ${GetParameters} $R0
  ${GetOptions} $R0 "--updated" $R1
  ${ifNot} ${Errors}
    Goto customUnInstallDone
  ${endif}

  SetShellVarContext current

  MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 \
    "是否删除 PwdBook 保存在本机的密码数据？$\r$\n$\r$\n选择「是」将删除保险库数据库及本地设置，且无法恢复。$\r$\n选择「否」仅卸载程序，数据将保留在 %APPDATA% 中。" \
    /SD IDNO IDNO noDelete IDYES yesDelete

  yesDelete:
    DetailPrint "正在删除用户数据…"
    RMDir /r "$APPDATA\${APP_FILENAME}"
    !ifdef APP_PRODUCT_FILENAME
      RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
    !endif
    !ifdef APP_PACKAGE_NAME
      RMDir /r "$APPDATA\${APP_PACKAGE_NAME}"
    !endif
    Goto customUnInstallDone

  noDelete:
    DetailPrint "已保留用户数据。"

  customUnInstallDone:
!macroend
