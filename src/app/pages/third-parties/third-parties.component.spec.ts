import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThirdPartiesComponent } from './third-parties.component';

describe('ThirdPartiesComponent', () => {
  let component: ThirdPartiesComponent;
  let fixture: ComponentFixture<ThirdPartiesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThirdPartiesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ThirdPartiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
