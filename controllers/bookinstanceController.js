const BookInstance = require("../models/bookinstance");
const Book = require("../models/book");

const { body, validationResult } = require("express-validator");
const asyncHandler = require("express-async-handler");

// すべてのBookInstanceのリストを表示
exports.bookinstance_list = asyncHandler(async (req, res, next) => {
  const allBookInstances = await BookInstance.find().populate("book").exec();

  res.render("bookinstance_list", {
    title: "蔵書インスタンス一覧",
    bookinstance_list: allBookInstances,
  });
});

// 特定のBookInstanceの詳細ページを表示
exports.bookinstance_detail = asyncHandler(async (req, res, next) => {
  const bookInstance = await BookInstance.findById(req.params.id)
    .populate("book")
    .exec();

  if (bookInstance === null) {
    // 結果なし
    const err = new Error("蔵書コピーが見つかりません");
    err.status = 404;
    return next(err);
  }

  res.render("bookinstance_detail", {
    title: "蔵書：",
    bookinstance: bookInstance,
  });
});

// BookInstance作成フォームをGETで表示
exports.bookinstance_create_get = asyncHandler(async (req, res, next) => {
  const allBooks = await Book.find({}, "title").sort({ title: 1 }).exec();

  res.render("bookinstance_form", {
    title: "蔵書インスタンスの作成",
    book_list: allBooks,
  });
});

// BookInstance作成をPOSTで処理
exports.bookinstance_create_post = [
  // フィールドのバリデーションとサニタイズ
  body("book", "本を指定してください").trim().isLength({ min: 1 }).escape(),
  body("imprint", "出版情報を指定してください")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("status").escape(),
  body("due_back", "無効な日付です")
    .optional({ values: "falsy" })
    .isISO8601()
    .toDate(),

  // バリデーションとサニタイズ後にリクエストを処理
  asyncHandler(async (req, res, next) => {
    // バリデーションエラーを抽出
    const errors = validationResult(req);

    // エスケープ・トリム済みデータでBookInstanceオブジェクトを作成
    const bookInstance = new BookInstance({
      book: req.body.book,
      imprint: req.body.imprint,
      status: req.body.status,
      due_back: req.body.due_back,
    });

    if (!errors.isEmpty()) {
      // エラーあり。フォームを再表示
      const allBooks = await Book.find({}, "title").sort({ title: 1 }).exec();

      res.render("bookinstance_form", {
        title: "蔵書インスタンスの作成",
        book_list: allBooks,
        selected_book: bookInstance.book._id,
        errors: errors.array(),
        bookinstance: bookInstance,
      });
      return;
    } else {
      // フォームデータは有効
      await bookInstance.save();
      res.redirect(bookInstance.url);
    }
  }),
];

// BookInstance削除フォームをGETで表示
exports.bookinstance_delete_get = asyncHandler(async (req, res, next) => {
  const bookInstance = await BookInstance.findById(req.params.id)
    .populate("book")
    .exec();

  if (bookInstance === null) {
    // 結果なし
    res.redirect("/catalog/bookinstances");
  }

  res.render("bookinstance_delete", {
    title: "蔵書インスタンスの削除",
    bookinstance: bookInstance,
  });
});

// BookInstance削除をPOSTで処理
exports.bookinstance_delete_post = asyncHandler(async (req, res, next) => {
  // 有効なBookInstance idがフィールドにあると仮定
  await BookInstance.findByIdAndDelete(req.body.id);
  res.redirect("/catalog/bookinstances");
});

// BookInstance更新フォームをGETで表示
exports.bookinstance_update_get = asyncHandler(async (req, res, next) => {
  // bookと全booksを並列取得
  const [bookInstance, allBooks] = await Promise.all([
    BookInstance.findById(req.params.id).populate("book").exec(),
    Book.find(),
  ]);

  if (bookInstance === null) {
    // 結果なし
    const err = new Error("蔵書コピーが見つかりません");
    err.status = 404;
    return next(err);
  }

  res.render("bookinstance_form", {
    title: "蔵書インスタンスの更新",
    book_list: allBooks,
    selected_book: bookInstance.book._id,
    bookinstance: bookInstance,
  });
});

// BookInstance更新をPOSTで処理
exports.bookinstance_update_post = [
  // フィールドのバリデーションとサニタイズ
  body("book", "本を指定してください").trim().isLength({ min: 1 }).escape(),
  body("imprint", "出版情報を指定してください")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("status").escape(),
  body("due_back", "無効な日付です")
    .optional({ values: "falsy" })
    .isISO8601()
    .toDate(),

  // バリデーションとサニタイズ後にリクエストを処理
  asyncHandler(async (req, res, next) => {
    // バリデーションエラーを抽出
    const errors = validationResult(req);

    // エスケープ・トリム済みデータと現在のidでBookInstanceオブジェクトを作成
    const bookInstance = new BookInstance({
      book: req.body.book,
      imprint: req.body.imprint,
      status: req.body.status,
      due_back: req.body.due_back,
      _id: req.params.id,
    });

    if (!errors.isEmpty()) {
      // エラーあり。フォームを再表示
      const allBooks = await Book.find({}, "title").exec();

      res.render("bookinstance_form", {
        title: "蔵書インスタンスの更新",
        book_list: allBooks,
        selected_book: bookInstance.book._id,
        errors: errors.array(),
        bookinstance: bookInstance,
      });
      return;
    } else {
      // フォームデータは有効
      await BookInstance.findByIdAndUpdate(req.params.id, bookInstance, {});
      // 詳細ページへリダイレクト
      res.redirect(bookInstance.url);
    }
  }),
];
