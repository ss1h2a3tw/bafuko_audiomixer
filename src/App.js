import React from 'react';

const META_URL = 'https://audio_bafuko_moe.storage.googleapis.com/meta.json';

var AudioContext = window.AudioContext || window.webkitAudioContext;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      metaLoaded: false,
    };
    this.audio = [];
  }
  componentDidMount() {
    this.actx = new AudioContext();
    fetch(META_URL)
      .then((res) => res.json())
      .then((res) => {
        window.console.log(res);
        let nextState = {
          metaLoaded: true,
          audioLoaded: [],
        };
        let pendingToLoad = [];
        this.audio = res;
        for (const idx in res) {
          nextState.audioLoaded.push(false);
          if (res[idx].default) {
            pendingToLoad.push(idx);
          }
        }
        this.setState(nextState);
        for (const idx of pendingToLoad) {
          this.loadAudio(idx);
        }
      });
  }
  loadAudio(idx) {
    fetch(this.audio[idx].url)
      .then((res) => res.blob())
      .then((res) => {
        let audio = this.audio[idx];
        audio.blob = res;
        audio.audioNode = new Audio(URL.createObjectURL(res));
        audio.audioSource = this.actx.createMediaElementSource(audio.audioNode);
        audio.audioSource.connect(this.actx.destination);
        let newState = {};
        this.setState((prevState) => {
          let nextAudioLoaded = [...prevState.audioLoaded];
          nextAudioLoaded[idx] = true;
          return { audioLoaded: nextAudioLoaded };
        });
        window.console.log(this.audio);
      });
  }
  play() {
    this.drum.play();
  }
  render() {
    if (!this.state.metaLoaded) {
      return <>LOADING!</>;
    } else {
      return (
        <>
          {this.filesize}
          <button onClick={this.play.bind(this)}>PLAY</button>
        </>
      );
    }
  }
}
export default App;
