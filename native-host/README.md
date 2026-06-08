# Native Messaging Host

本目录为 **随安装包分发的桥接程序**：

- **Windows**：`pwdbook-native-host.cmd` + `index.mjs`
- **macOS**（v1.12.0）：`pwdbook-native-host.sh` + `index.mjs`

`com.pwdbook.app.json` 仅为**模板**，其中的 `REPLACE_*` 占位符不会直接被浏览器使用。

请在 PwdBook **设置 → 安全 → 浏览器自动填充** 中填写扩展 ID 并点击 **「注册到 Chrome / Edge」**，届时会在用户目录生成有效清单：

```
# Windows
%APPDATA%\pwd-book\native-host\com.pwdbook.app.json

# macOS
~/Library/Application Support/pwd-book/native-host/com.pwdbook.app.json
```

开发环境也可执行：`npm run register-native-host -- <扩展ID>`
