; PwdBook uninstall: optionally remove local vault data (skip during in-place updates).

!macro customUnInstall
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
