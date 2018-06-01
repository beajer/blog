- Native调用Javascript语言\
  是通过UIWebView组件的stringByEvaluatingJavaScriptFromString方法来实现的，该方法返回js脚本的执行结果。
  ```js
  webview.stringByEvaluatingJavaScriptFromString("Math.random()")
  // 在window作用域下访问
  ```
- Javascript调用Native\
  - IWebView有个特性：在UIWebView内发起的所有网络请求，都可以通过delegate函数在Native层得到通知。这样，我们就可以在UIWebView内发起一个自定义的网络请求，通常是这样的格式
    ```js
    // localtion.href (连续修改,会只接收最后一次请求)
    // iframe.src
    let href = `jsbridge://methodName?param1=value1&param2=value2`
    ```
  - 通过在webview页面里直接注入原生js代码方式，使用addJavascriptInterface方法来实现。
    ```java
    class JSInterface {
        @JavascriptInterface //注意这个代码一定要加上
        public String getUserData() {
            return "UserData";
        }
    }
    webView.addJavascriptInterface(new JSInterface(), "AndroidJS");
    ```
  - 使用prompt,console.log,alert方式，这三个方法对js里是属性原生的，在android webview这一层是可以重写这三个方法的。