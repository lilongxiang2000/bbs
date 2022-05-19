const express      = require('express')
const cookieParser = require('cookie-parser')
const fs           = require('fs')
const svgCaptcha   = require('svg-captcha')
const md5          = require('md5')
const DB           = require('better-sqlite3')


const PORT     = 8080
const app      = express()
const db       = new DB('./bbs.sqlite3')


const dbSelectUserByName = db.prepare(
  'select * from users where username = $username'
)
const dbInsertUser = db.prepare(
  'insert into users values ($username,$password,$email,$joinDate)'
)

const dbSelectPostByID = db.prepare(
  'select * from visiblePosts where id=$id'
)
const dbSelectPostByName = db.prepare(
  'select * from visiblePosts where author=$author'
)
const dbSelectPostsReverse = db.prepare(
  'select * from visiblePosts order by createDate desc limit $n'
)
const dbInsertPost = db.prepare(
  'insert into posts values ($id,$title,$content,$author,$createDate,$isDelete)'
)
const dbDeletePostByID = db.prepare(
  'update posts set isDelete=1 where id=$id'
)

const dbSelectCommentsByPostID = db.prepare(
  'select * from visibleComments where postID=$postID order by createDate desc'
)
const dbSelectCommentsByID = db.prepare(
  'select * from visibleComments where id=$id'
)
const dbInsertComment = db.prepare(
  'insert into comments values ($id,$content,$author,$postID,$createDate,$isDelete)'
)
const dbDeleteCommentByID = db.prepare(
  'update comments set isDelete=1 where id=$id'
)


function timeLocale() {
  return new Date().toLocaleString()
}
/** Converts the characters "&", "<", ">", '"',
 * and "'" in string to their corresponding HTML entities.
 * @param {*} str
 * @returns {String}
 */
function escapeHTML(str) {
  // 防止 sxx 攻击
  str = str.toString()

  str = str.split('&').join('&amp;')
  str = str.split('<').join('&lt;')
  str = str.split('>').join('&gt;')
  str = str.split('"').join('&quot;')
  str = str.split("'").join('&#39;')

  return str
}

// 解码 url 编码请求体
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser('bbs'))


// 防止 xss 攻击
app.post('*', (req, res, next) => {
  if (req.body) {
    for (let key in req.body) {
      let newHTML = escapeHTML(req.body[key])
      if (newHTML != req.body[key]) {
        console.warn('xss!!!', req.body[key])
        req.body[key] = newHTML
      }
    }
  }

  next()
})


// 将当前登录用户保存到 req.body.self
app.get('*', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    let user = {username: req.signedCookies.loginUser}
    req.body.self = dbSelectUserByName.get(user) ?? null
  }

  next()
})


const sessionObjs = {}
app.use(function sessionMW(req, res, next) {
  if (!req.cookies.sessionID) {
    let sessionID = Date.now()
    res.cookie('sessionID', sessionID)
    req.cookies.sessionID = sessionID
  }

  req.session = sessionObjs[req.cookies.sessionID] ?? (sessionObjs[req.cookies.sessionID] = {})

  next()
})


// ./
app.get('/', (req, res, next) => {
  // 按时间显示最近 10 篇帖子
  let showPosts = dbSelectPostsReverse.all({n: 10})

  if (!req.body.self) res.clearCookie('loginUser')

  res.type('html').render('index.pug', {
    showPosts,
    loginUser: req.body.self
  })

  next()
})


app.get('/captcha', (req, res, next) => {
  let captcha = svgCaptcha.create({
    color: true,
    noise: 4,
    ignoreChars: '0oOI1i'
  })
  req.session.captcha = captcha.text
  res.type('svg').end(captcha.data)

  next()
})

// user
app.get('/user/:username', (req, res, next) => {
  let user = dbSelectUserByName.get(req.params)

  if (user) {
    let userPosts = dbSelectPostByName.all({author: user.username})

    res.type('html').render('user.pug', {
      loginUser: req.signedCookies.loginUser
        ? req.body.self : null,
      user: user,
      userPosts: userPosts
    })
  } else res.type('html').render('404.pug')

  next()
})


// register
app.get('/register', (req, res, next) => {
  res.type('html').render('register.pug')

  next()
})
app.post('/register', (req, res, next) => {
  console.log(req.body)

  const userReg = /^[a-zA-Z0-9]{3,12}$/
  const pwdReg  = /^[a-zA-Z0-9_]{8,24}$/

  if (
    userReg.test(req.body.username) &&
    pwdReg.test(req.body.password)
  ) {
    let userInfo = {
      username: req.body.username,
      email   : req.body.email,
      password: md5(req.body.password + md5(req.body.password.length)),
      joinDate: timeLocale()
    }

    try {
      dbInsertUser.run(userInfo)
      res.type('html').render('registerErrS.pug')
    } catch (err) {
      console.log(err)
      res.type('html').render('registerErr.pug')
    }
  } else res.end('Wrong format')



  next()
})


// login
app.get('/login', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    res.redirect('/')
  } else res.type('html').render('login.pug', {
    loginErrCount: req.session.loginErrCount
  })

  next()
})
app.post('/login', (req, res, next) => {
  let loginInfo = {
    username: req.body.username,
    password: md5(
      req.body.password + md5(req.body.password.length)
    )
  }

  let captcha = req.body.captcha
    ? req.session.captcha == req.body.captcha
    : true

  let selectUser = dbSelectUserByName.get(loginInfo)

  if (
    captcha && selectUser &&
    selectUser.password == loginInfo.password
  ) {
    res.cookie('loginUser', loginInfo.username, {
      maxAge: 86400000, // 一天
      signed: true,
    })
    req.session.loginErrCount = 0
    res.redirect('/')
  } else {
    req.session.loginErrCount = (req.session.loginErrCount ?? 0) + 1
    res.type('html').render('loginErr.pug', {captcha})
  }

  next()
})


// logout
app.get('/logout', (req, res, next) => {
  res.clearCookie('loginUser')
  res.redirect('/login') // 回到主页

  next()
})


// post
app.get('/post/:id', (req, res, next) => {
  let post = dbSelectPostByID.get({id: req.params.id})

  if (post) {
    let thisComments = dbSelectCommentsByPostID.all(
      {postID: req.params.id}
    )

    res.type('html').render('post.pug', {
      loginUser: req.body.self,
      post,
      thisComments
    })
  } else res.type('html').render('404.pug')

  next()
})
app.delete('/post/:id', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    let post = dbSelectPostByID.get({id: req.params.id})

    if (post && post.author == req.signedCookies.loginUser) {
      dbDeletePostByID.run({id: req.params.id})
    }
  } else res.redirect('/login')

  next()
})
app.post('/post', (req, res, next) => {
  // 已登录用户才可发帖
  if (req.signedCookies.loginUser) {
    let postInfo = {
      id        : `${Date.now()}`,
      title     : req.body.title.slice(0, 20),
      content   : req.body.content,
      author    : req.signedCookies.loginUser,
      createDate: timeLocale(),
      isDelete  : 0
    }

    try {
      if (postInfo.title.length) {
        dbInsertPost.run(postInfo)
        res.redirect(`/post/${postInfo.id}`)
      }
    } catch (err) {
      console.log('add Post', err)
    }
  }

  next()
})


// comment
app.post('/comment/:postID', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    // 防止传来 脏数据
    let commentInfo = {
      id        : `${Date.now()}`,
      content   : req.body.content,
      author    : req.signedCookies.loginUser,
      postID    : req.params.postID,
      createDate: timeLocale(),
      isDelete  : 0
    }
    if (commentInfo.content.length < 300) {
      try {
        dbInsertComment.run(commentInfo)
      } catch (err) {
        console.log(err)
      }
      res.redirect(`/post/${req.params.postID}`)
    } else res.end('Comment is too long')

  } else res.redirect('/login')

  next()
})
app.delete('/comment/:commentID', (req, res, next) => {
  if (req.signedCookies.loginUser) {
    let comment = dbSelectCommentsByID.get({id: req.params.commentID})
    if (comment && comment.author == req.signedCookies.loginUser) {
      dbDeleteCommentByID.run({id: comment.id})
    } else { // 判断当前评论是否在 登录用户 的帖子下
      let post = dbSelectPostByID.get({id: comment.postID})
      if (post && post.author == req.signedCookies.loginUser) {
        dbDeleteCommentByID.run({id: comment.id})
      }
    }
  } else res.redirect('/login')

  next()
})


app.listen(PORT, '127.0.0.1', () => {
  console.log('Listening on', PORT)
})
