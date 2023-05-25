<a name="readme-top"></a>


<!-- ABOUT THE PROJECT -->
## About The Project

This application takes in a filepath to an epub file and a language as parameters. 
From this it will create a text file from the epub and also convert the block of text into an audio MP3 file.
I wanted to make this because a bunch of books I read don't have an associated audiobook and I get more reading done if I can supplement it with audio.
The app uses the google text to speech npm lib to convert the text.

Hoping this helps you out also!

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Installation

1. Clone the repo
   ```
   git clone https://github.com/elinero/audiobook_converter.git
   ```
2. After checking out the repo run:
   ```
   npm i
   ```
  Then you can use the start script to input the file path to your epub and the desired language

  ```
  npm run start /path/to/my/epub english
  ```
  The app will run and place the text file under the textfiles folder.
  When the audio is finished it will place your audio file under the audiobooks folder.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
