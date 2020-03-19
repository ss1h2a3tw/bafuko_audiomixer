import React from 'react';

const TEST_DRUM = 'https://audio_bafuko_moe.storage.googleapis.com/drum.wav';
var AudioContext = window.AudioContext || window.webkitAudioContext;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loaded: false
    };
  }
  componentDidMount() {
    this.actx = new AudioContext();
    fetch(TEST_DRUM)
      .then(res => res.blob())
      .then(res => {
        this.drumblob = res;
        this.drum = new Audio(URL.createObjectURL(res));
        this.drumtrack = this.actx.createMediaElementSource(this.drum);
        this.drumtrack.connect(this.actx.destination);
        this.filesize = res.size;
        this.setState({ loaded: true });
      });
  }
  play() {
    this.drum.play();
  }
  render() {
    if (!this.state.loaded) {
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
