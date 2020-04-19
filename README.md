# Cycloop Web Application

This is a repository for the **Cycloop** web application, available at [https://cycloop.app](https://cycloop.app). Beta branch is deployed at [https://beta.cycloop.app](https://beta.cycloop.app).

Other repositories:

1. Cycloop Portal [GitHub](https://github.com/sportloop/cycloop-portal).
2. Cycloop Roadmap [GitHub](https://github.com/sportloop/cycloop-roadmap).

## Get started as a user

Visit the website at [https://cycloop.app](https://cycloop.app).

## Get started as a developer

1. Fork this repository at [https://github.com/sportloop/cycloop-web](https://github.com/sportloop/cycloop-web).
2. Clone your forked repository.
3. Install dependencies - `yarn install`.
4. Start the application locally - `yarn develop`.
5. Visit your copy of the application at [http://0.0.0.0:3000](http://0.0.0.0:3000).

## Making changes

This repository is hooked up with `husky`, `lint-staged` and `commitlint`, which runs `eslint` and checks your commit message before commiting changes. To comply with these rules, you can make sure `eslint` is properly set up in your IDE (e.g.: in VSCode it should work automatically) and errors in your changes will be highlighted. Commit messages follow [conventional commit standard](https://www.conventionalcommits.org/en/v1.0.0-beta.4/). Commits will be squashed before they enter `master`, so make sure to create a pull request for each meaningful change you'd like to distinguish.

## Creating a Pull Request

If there's a ticket describing the issue your PR resolves make sure you link that ticket number in your PR description, title, or in one of the commits. You should point your PR to `beta` branch for new features and to `master` branch for bug fixes in production.

Once you submit your PR, [Now](https://now.sh) will automatically deploy your changes to a unique URL that you can visit to test those changes in a real environment.

## Having an accepted PR

Your PR will be accepted after review. Once this happens you will get a chance to join the development team on GitHub, which will change your workflow somewhat. You will be able to create branches in the main repository and have access to more private discussions about the project. Do not feel an obligation to accept this, but know that this being a fully open source and not-funded project your contribution is greatly appreciated.
