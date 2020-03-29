import React from 'react';

const META_URL = 'https://audio_bafuko_moe.storage.googleapis.com/meta.json';
const SAMPLE_RATE = 44100;
const LENGTH = 10140950;

var AudioContext = window.AudioContext || window.webkitAudioContext;
var OfflineAudioContext = window.OfflineAudioContext;

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
    this.mainNode = this.actx.createBufferSource();
    this.offlineActx = new OfflineAudioContext(2, LENGTH, SAMPLE_RATE);
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
      .then((res) => res.arrayBuffer())
      .then((res) => {
        let audio = this.audio[idx];
        audio.arrayBuffer = res;
        this.offlineActx.decodeAudioData(
          res,
          (buffer) => {
            audio.audioSource = this.offlineActx.createBufferSource();
            audio.audioSource.buffer = buffer;
            audio.audioSource.connect(this.offlineActx.destination);
            audio.audioSource.start(0);
          },
          () => {
            window.console.log('Failed to load ' + audio.name);
          }
        );
        this.setState((prevState) => {
          let nextAudioLoaded = [...prevState.audioLoaded];
          nextAudioLoaded[idx] = true;
          return { audioLoaded: nextAudioLoaded };
        });
        window.console.log(this.audio);
      });
  }
  prepare() {
    this.offlineActx.startRendering().then((buffer) => {
      console.log('Rendering completed successfully');
      this.mainNode.buffer = buffer;
      this.mainNode.connect(this.actx.destination);
    });
  }
  play() {
    this.mainNode.start();
  }
  render() {
    if (!this.state.metaLoaded) {
      return <>LOADING!</>;
    } else {
      return (
        <>
          {this.filesize}
          <button onClick={this.prepare.bind(this)}>PREPARE</button>
          <button onClick={this.play.bind(this)}>PLAY</button>
        </>
      );
    }
  }
}
export default App;
