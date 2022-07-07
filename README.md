# 使用 Express + SQLite + Pug 实现的简易论坛

# 界面展示
![](public/assets/img/demo.png)

# 功能列表
- 登录（验证码验证）、注册
- 发帖、删贴
- 评论、删除评论
- 头像上传

# 技术栈

## 前端
- ES6：ECMAScript 新一代语法，模块化、解构赋值
- Bootstrap：前端样式框架

## 后端
- Express：使用 Express 进行后端的开发
- Pug：使用 Pug 模板引擎渲染前端请求的页面

## 数据库
数据库结构如下
```SQL
CREATE TABLE users(
  username text primary key,
  password text not null,
  email text not null unique,
  joinDate text not null,
  avatarLink text,
  avatarChangeDate text,
  mimetype text
);
CREATE TABLE posts(
  id text primary key,
  title text not null,
  content text not null,
  author text not null,
  createDate text not null,
  isDelete integer not null
);
CREATE TABLE comments(
  id text primary key,
  content text not null,
  author text not null,
  postID text not null,
  createDate text not null,
  isDelete integer not null
);
CREATE VIEW visiblePosts as select * from posts where isDelete=0;
/* visiblePosts(id,title,content,author,createDate,isDelete) */
CREATE VIEW visibleComments as select * from comments where isDelete=0;
/* visibleComments(id,content,author,postID,createDate,isDelete) */
```

# Install & Run
```bash
npm install
node bbs.js
# http://127.0.0.1:8080
```
