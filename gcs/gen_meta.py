#!/usr/bin/env python3
"""This script is to generate meta.json to index the audio files"""
import json

BASE_URL = 'https://audio_bafuko_moe.storage.googleapis.com/'

def add_element(dst_list, name, url, default, offset):
    """a helper function"""
    dst_list.append({'name': name, 'url': url, 'default': default, 'offset': offset})

def main():
    """main function"""
    audio_list = []
    inst_list = ['bass', 'drum', 'piano', 'guitar']
    for inst in inst_list:
        add_element(audio_list, inst, BASE_URL+inst+'.mp3', True, 0)
        add_element(audio_list, inst+' (loseless)', BASE_URL+inst+'.flac', False, 40)
    print(json.dumps(audio_list))

if __name__ == '__main__':
    main()
